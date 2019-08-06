const fs = require('fs');
const util = require('util');
const path = require('path');
const JSZip = require('jszip');
const streamBuffers = require('stream-buffers');
const cheerio = require('cheerio');
let rq = require('request');

const { login, jar } = require('./login');

rq = rq.defaults({ jar });
const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);

const { SAVE_PATH, PREFER_SAMPLED } = process.env;
const transform = body => cheerio.load(body);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const preferSampled = PREFER_SAMPLED
  ? PREFER_SAMPLED.trim().toLowerCase() !== 'false'
  : true;

/* eslint-disable no-await-in-loop */
async function retryWrapper(func, ...args) {
  let result;
  let success = false;
  do {
    try {
      result = await func(...args);
      success = true;
    } catch (err) {
      console.log(err.name, err.message);
      success = false;
      await sleep(3000);
    }
  } while (!success);

  return result;
}
/* eslint-enable no-await-in-loop */

function createStreamBuffer() {
  const mb = 2 ** 20;
  return new streamBuffers.WritableStreamBuffer({
    initialSize: 1024 * 1024,
    incrementAmount: 1024 * 1024,
    frequency: 1,
    chunkSize: mb * 10,
  });
}

function filterBadCharacters(filename) {
  let newFileName = filename;
  newFileName = newFileName.replace(/\?/g, '');
  newFileName = newFileName.replace(/\*/g, '');
  newFileName = newFileName.replace(/:/g, ' - ');
  newFileName = newFileName.replace(/\//g, '');
  newFileName = newFileName.replace(/\\/g, '');
  newFileName = newFileName.replace(/\|/g, '');
  newFileName = newFileName.replace(/</g, '(');
  newFileName = newFileName.replace(/>/g, ')');
  newFileName = newFileName.replace(/"/g, '`');
  newFileName = newFileName.replace(/\s{1,}/g, ' ');
  return newFileName;
}

async function downloadFullsize(imageUrl) {
  return new Promise((resolve, reject) => {
    const stream = createStreamBuffer();
    let filename;
    rq(imageUrl, { timeout: 5000 })
      .on('end', () => {
        const buffer = stream.getContents();
        resolve({ buffer, filename });
      })
      .on('error', reject)
      .on('data', data => stream.write(data))
      .on('response', (response) => {
        [filename] = response.headers['content-disposition'].match(
          /(?<=filename=)(\S{1,}\.\S{3,})/g,
        );
      });
  });
}

async function downloadSampled(imageUrl, filename) {
  return new Promise((resolve, reject) => {
    const stream = createStreamBuffer();
    rq(imageUrl, { timeout: 5000 })
      .on('end', () => {
        const buffer = stream.getContents();
        resolve({ buffer, filename });
      })
      .on('error', reject)
      .on('data', data => stream.write(data));
  });
}

/* eslint-disable no-await-in-loop, no-restricted-syntax */
async function downloadImages(galleryData) {
  const pages = [...galleryData.pages];
  const downloadedPages = [];

  const downloadSelector = page => (!preferSampled && page.original
    ? retryWrapper(downloadFullsize, page.original)
    : retryWrapper(downloadSampled, page.sampled, page.filename));

  while (pages.length) {
    const pagesOnQueue = pages.splice(0, preferSampled ? 5 : 1);
    const dlPromises = pagesOnQueue.map(page => downloadSelector(page));
    const downloadedDataArr = await Promise.all(dlPromises);
    downloadedPages.push(...downloadedDataArr);
    console.log(`Pages remaining: ${pages.length}`);
    await sleep(1000);
  }

  console.log('Compressing as zip file...');

  const zip = new JSZip();
  downloadedPages.forEach(({ filename, buffer }) => zip.file(`pages/${filename}`, buffer));

  const galleryMetadata = {
    ...galleryData.galleryInfo,
    tags: galleryData.tags,
  };
  zip.file('gallery.json', JSON.stringify(galleryMetadata, null, 2));

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  const zipPath = path.join(
    SAVE_PATH,
    `${filterBadCharacters(galleryData.galleryInfo.englishName)}.zip`,
  );
  await mkdir(SAVE_PATH, { recursive: true });

  await writeFile(zipPath, zipBuffer);

  console.log('Your gallery has been saved!');
}
/* eslint-disable no-await-in-loop, no-restricted-syntax */

/* eslint-disable no-await-in-loop */
async function scrapePages($, request) {
  const firstPage = $('div#gdt > div a').attr('href');

  const pages = [];
  let pageUrl = firstPage;
  let hasNextPage = false;

  do {
    const $page = await retryWrapper(request, {
      uri: pageUrl,
      transform,
      timeout: 5000,
    });
    const isFullsizeAvailable = $page('div#i7[class] > a').get().length > 0;
    const filename = $page('div#i4 > div')
      .text()
      .split('::')[0]
      .trim();

    const nextPage = $page('div#i3 > a').attr('href');
    hasNextPage = nextPage !== pageUrl;

    pages.push({
      filename,
      sampled: $page('div#i3 > a > img#img').attr('src'),
      original: isFullsizeAvailable
        ? $page('div#i7[class] > a').attr('href')
        : null,
    });

    console.log('page scraped:', pageUrl);
    if (hasNextPage) pageUrl = nextPage;

    await sleep(250);
  } while (hasNextPage);

  return pages;
}
/* eslint-enable no-await-in-loop */

function convertToBytes(bytesString) {
  const [numeral, unit] = bytesString
    .split(' ')
    .map(val => val.toLowerCase().trim())
    .map(val => (!Number.isNaN(parseInt(val, 10)) ? parseFloat(val) : val));

  let value;
  switch (unit) {
    case 'tb':
      value = 1024 ** 4;
      value *= numeral;
      break;

    case 'gb':
      value = 1024 ** 3;
      value *= numeral;
      break;

    case 'mb':
      value = 1024 ** 2;
      value *= numeral;
      break;

    case 'kb':
      value = 1024 * numeral;
      break;

    case 'b':
    default:
      value = numeral;
      break;
  }

  return Math.round(value);
}

function getGalleryTags($) {
  const tags = $('div#gmid > div#gd4 > div#taglist td > div[id][class][style]')
    .get()
    .map(tag => cheerio(tag).attr('id'))
    .map(tag => tag.replace(/td_/g, ''));
  return tags;
}

function getGalleryInfo($) {
  const englishName = $('div.gm > div#gd2 > h1#gn').text();
  const japaneseName = $('div.gm > div#gd2 > h1#gj').text();
  const type = $('div#gmid > div#gd3 > div#gdc > div.cs').text();
  const uploaderName = $('div#gmid > div#gd3 > div#gdn > a').text();
  const uploaderUrl = $('div#gmid > div#gd3 > div#gdn > a').attr('href');
  const datePosted = $(
    'div#gmid > div#gd3 > div#gdd tr:nth-child(1) > td:last-child',
  ).text();
  const parent = $(
    'div#gmid > div#gd3 > div#gdd tr:nth-child(2) > td:last-child',
  ).text();
  const visible = $('div#gmid > div#gd3 > div#gdd tr:nth-child(3) > td:last-child')
    .text()
    .toLowerCase() === 'yes';
  const language = $(
    'div#gmid > div#gd3 > div#gdd tr:nth-child(4) > td:last-child',
  )
    .text()
    .split(' ')[0];

  const fileSize = convertToBytes(
    $('div#gmid > div#gd3 > div#gdd tr:nth-child(5) > td:last-child').text(),
  );

  const pageCount = parseInt(
    $('div#gmid > div#gd3 > div#gdd tr:nth-child(6) > td:last-child')
      .text()
      .split(' ')[0],
    10,
  );
  const favoritedCount = parseInt(
    $('div#gmid > div#gd3 > div#gdd tr:nth-child(7) > td:last-child')
      .text()
      .split(' ')[0],
    10,
  );
  const ratingCount = parseInt(
    $('div#gmid > div#gd3 > div#gdr tr:first-child td:last-child').text(),
    10,
  );
  const ratingAverage = parseFloat(
    $('div#gmid > div#gd3 > div#gdr tr:last-child > td')
      .text()
      .split(' ')[1],
  );
  let favoriteList = $('div#gmid > div#gd3 > div#gdf > div > a').text();
  favoriteList = favoriteList.includes('Add to Favorites')
    ? null
    : favoriteList;

  return {
    englishName,
    japaneseName,
    type,
    uploaderName,
    uploaderUrl,
    datePosted,
    parent,
    visible,
    language,
    fileSize,
    pageCount,
    favoritedCount,
    ratingCount,
    ratingAverage,
    favoriteList,
  };
}

async function getGallery(galleryUrl) {
  const request = await login();

  const $gallery = await request({
    uri: galleryUrl,
    transform,
  });

  const galleryInfo = getGalleryInfo($gallery);
  galleryInfo.galleryUrl = galleryUrl;

  const tags = getGalleryTags($gallery);

  const pages = await scrapePages($gallery, request);

  const result = {
    galleryInfo,
    tags,
    pages,
  };

  await downloadImages(result);

  return result;
}

module.exports = getGallery;
