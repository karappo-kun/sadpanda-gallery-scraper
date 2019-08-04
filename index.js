require('dotenv').config();
const getGallery = require('./lib/gallery');

(async () => {
  const { GALLERY_URL } = process.env;

  await getGallery(GALLERY_URL);
})();
