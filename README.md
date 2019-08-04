# Sadpanda Gallery Scraper

Download your Sadpanda galleries offline for backup and archival purposes, just in case.

## How to use

- Download and install [Node.js v10](https://nodejs.org/en/)
- Clone this repo
  ```bash
  git clone https://github.com/karappo-kun/sadpanda-gallery-scraper.git
  ```
- Navigate inside the directory and install the dependencies
  ```bash
  cd ./sadpanda-gallery-scraper
  npm i
  ```
- Create an `.env` config file and paste the following. Make sure to replace the relevant fields with your Sadpanda credentials.
  ```
  SADPANDA_USER=mysadpandaaccount
  SADPANDA_PASS=mypassword
  SAVE_PATH=./saved
  PREFER_SAMPLED=true
  GALLERY_URL=https://sadpanda.org/g/<some_id>/<another_id>/
  ```
- Run the scraper
  ```bash
  npm start
  ```
- Once the scraper is finished, your gallery should now be stored as a zip file in the saved directory (or whatever SAVE_PATH value you chose).

## Gallery format

All downloaded galleries will be packaged as a zip file (for now) and it has the following structure.

```
- /gallery.json
- /pages
-   /01.jpg
-   /02.jpg
-   /03.jpg
-   /...
```

The `/pages` directory contains all the downloaded pages while the `gallery.json` contains the gallery metadata.

## Future plans, maybe

I'm planning to make a gallery reader that will utilize this format maybe sometime in the future (possibly using Electron.js and React). Also, I'll probably be changing the extension to `.ogf` and call it _Open Gallery Format_ or something, and maybe add some fancy stuff like annotation for translation purposes like you'd see on Danbooru pages. Who knows...

## License

MIT
