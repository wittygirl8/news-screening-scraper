import express from 'express';
import cors from 'cors';

const googleNewsScraper = require('google-news-scraper');

const fs = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

var bodyParser = require('body-parser')

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.json())

// -----------  Custom Crawler Functions - (Get Articles)

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Configure axios defaults
const axiosInstance = axios.create({
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate', // Excluding 'br' to disable Brotli encoding
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
});

// Enhanced site-specific selectors with multiple fallbacks
const siteSelectors = {
    'thehindu.com': {
        title: ['h1.title', '.article-title', '#content-body h1'].join(', '),
        content: [
            'div.article, article',
            '#content-body-14269002-1',
            '.article-text',
            '#content-body'
        ].join(', ')
    },
    'news18.com': {
        title: ['h1', '.article_heading', '.articleheading'].join(', '),
        content: [
            '.article-body',
            '.article-content',
            '[itemprop="articleBody"]',
            '.content_text',
            ".p"
        ].join(', ')
    },
    'hindustantimes.com': {
        title: ['h1.hdg1', '.article-headline', '.story-headline'].join(', '),
        content: [
            '.articleBody',
            '.storyDetail',
            '.story-details',
            '[data-vars-cardtype="article"]'
        ].join(', ')
    },
    default: {
        title: [
            'h1',
            'h1.entry-title',
            'article h1',
            '.post-title',
            '.article-title'
        ].join(', '),
        content: [
            'article',
            '[itemprop="articleBody"]',
            '.article-content',
            '.post-content',
            '.entry-content',
            'main'
        ].join(', ')
    }
};

async function extractArticleContent(url, html) {
    const $ = cheerio.load(html);
    const hostname = new URL(url).hostname;

    // Get site-specific selectors or fall back to defaults
    const selectors = Object.entries(siteSelectors).find(([domain]) =>
        hostname.includes(domain))?.[1] || siteSelectors.default;

    // Remove unwanted elements
    $('script, style, iframe, nav, header, footer, .ads, .related-articles, .social-share, .subscribe-block, .comments').remove();

    // Extract title
    const title = $(selectors.title).first().text().trim();

    // Extract content with more robust approach
    let content = '';

    // Try multiple methods to get content
    const contentElement = $(selectors.content);
    if (contentElement.length) {
        // Method 1: Direct text extraction
        content = contentElement.text().trim();

        if (!content) {
            // Method 2: Paragraph by paragraph
            content = contentElement.find('p')
                .map((_, el) => $(el).text().trim())
                .get()
                .filter(text => text.length > 0)
                .join('\n\n');
        }
    }

    // If still no content, try a more aggressive approach
    if (!content) {
        content = $('p')
            .map((_, el) => $(el).text().trim())
            .get()
            .filter(text =>
                text.length > 0 &&
                text.split(' ').length > 5 && // Only paragraphs with more than 5 words
                !text.includes('copyright') && // Filter out common unwanted text
                !text.includes('Cookie') &&
                !text.includes('Subscribe')
            )
            .join('\n\n');
    }

    // Clean up the content
    content = content
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n\n')  // Replace multiple newlines with double newlines
        .trim();

    console.log(`Content length for ${hostname}: ${content.length} characters`);

    if (!content) {
        console.warn(`Warning: No content extracted from ${url}`);
    }

    return {
        title,
        content,
        url,
        timestamp: new Date().toISOString(),
        contentLength: content.length
    };
}

async function scrapeArticle(article) {
    try {
        // Extraction of direct URL from Google News redirect URL should already be handled
        // let directUrl = new URL(article.link);
        // console.log(article)
        // let directUrl = new URL(article.decoding.decoded_url);

        let directUrl;

        if (article.decoding && article.decoding.decoded_url) {
            // If decoding object and decoded_url are present
            directUrl = new URL(article.decoding.decoded_url);
        } else {
            // If decoding or decoded_url is missing, fall back to article link
            directUrl = new URL(article.link);
        }



        if (!directUrl) {
            const match = article.link.match(/url=(.*?)(?:&|$)/);
            directUrl = match ? decodeURIComponent(match[1]) : article.link;
        }

        console.log(`Fetching: ${directUrl}`);

        const response = await axiosInstance.get(directUrl);

        if (!response.data) {
            throw new Error('No HTML content received');
        }

        const content = await extractArticleContent(directUrl, response.data);

        // Validate content
        if (!content.content) {
            console.warn(`Warning: No content extracted from ${directUrl}`);
        }

        return {
            original: article,
            scraped: content,
            success: true
        };

    } catch (error) {
        console.error(`Error scraping ${article.title}:, ${error.message}`);
        return {
            original: article,
            error: error.message,
            success: false
        };
    }
}

async function scrapeAllArticles(articles) {
    const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
    const results = [];
    for (const article of articles) {
        const result = await scrapeArticle(article);
        results.push(result);

        // Add delay between requests
        await delay(RATE_LIMIT_DELAY);
    }

    return results;
}


// -----------  Crawler Functions - Google News Scraper (Get Links)
const getResultsFromScraper = async (query) => {
    return await googleNewsScraper({
        searchTerm: query, puppeteerArgs: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
        ],
    });
};

// Endpoint for extracting links given a query
app.get('/search/:query', async (req,res ) => {
    const query = req.params.query;
    try {
        const data = await getResultsFromScraper(query);
        res.json(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Endpoint for scraping articles given article links
// req.body : list of dictionaries - each dictionary is an article links and its data including the decoded url:
// Example if req body - TODO Add schema validation
// [
//     {
//         "title": "Heading of Article etc etc...",
//         "link": "https://news.google.com/read/CBMiWk...",
//         "image": "https://news.google.com/api/attachments/CC8iI...",
//         "source": "actualnewswebsite name",
//         "datetime": "2024-10-22T23:02:57.000Z",
//         "time": "Yesterday",
//         "articleType": "regular",
//         "decoding": {
//             "status": true,
//             "decoded_url": "https://www.actualnewswebsite.com/news/articles/ce3z..."
//         }
//     }
// ]
app.post('/scrapeArticles/', async (req,res ) => {

    const articles = req.body;
    console.log(`Starting to scrape ${articles.length} articles...`);

    try {
        const data = await scrapeAllArticles(articles);
        res.json(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/scrapeSingleArticle/', async (req,res ) => {

    const article = req.body;
    console.log(`Starting to scrape article...`);

    try {
        const data = await scrapeArticle(article);
        res.json(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: '503!' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

export default app;
