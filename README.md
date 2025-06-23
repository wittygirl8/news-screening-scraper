# coe-poc-scraper
Javascript app to run webcrawler used in news screening application

## Pre-requisites
Ensure you have npm and bun installed before cloning this repo:

Installing bun: 
```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

## Installation

After cloning, use npm to install this scraper

Set configurations to overcome proxy issues:
```bash
set NODE_TLS_REJECT_UNAUTHORIZED=0

npm config set strict-ssl false
```

```bash
npm install
```

## Usage
### Start application
Start the application with:

```bash
set NODE_TLS_REJECT_UNAUTHORIZED=0
npm config set strict-ssl false

bun index.js
```

### /scrapeArticles
```python
import requests
import json

url = "http://localhost:3001/scrapeArticles"

payload = json.dumps(
[
     {
         "title": "Heading of article etc etc...",
         "link": "https://news.google.com/read/CBMiWk...",
         "image": "https://news.google.com/api/attachments/CC8iI...",
         "source": "actualnewswebsite name",
         "date": "2024-10-22",
         "time": "Yesterday",
         "articleType": "regular",
         "decoding": {
             "status": true,
             "decoded_url": "https://www.actualnewswebsite.com/news/articles/ce3z..."
         }
     }
 ]
)

headers = {
  'Content-Type': 'application/json'
}

response = requests.request("POST", url, headers=headers, data=payload)

print(response.text)
```
