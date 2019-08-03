require('dotenv').config();
// const login = require('./lib/login');
const getGallery = require('./lib/gallery');

(async () => {
  // const request = await login();

  // const galleryUrl = 'https://exhentai.org/g/689418/7fb9d5b310/';
  // const galleryUrl = 'https://exhentai.org/g/1452116/1d0fc2779a/';
  // const galleryUrl = 'https://exhentai.org/g/1456825/3db2529829/';
  // const galleryUrl = 'https://exhentai.org/g/1438739/758825a918/';
  // const galleryUrl = 'https://exhentai.org/g/700698/aaef5c99f5/';
  const galleryUrl = 'https://exhentai.org/g/1408701/959c6e9a55/';

  const galleryInfo = await getGallery(galleryUrl);
  console.log(galleryInfo);
})();
