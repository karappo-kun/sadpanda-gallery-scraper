require('dotenv').config();
const getGallery = require('./lib/gallery');

(async () => {
  const { GALLERY_URL } = process.env;

  const galleryInfo = await getGallery(GALLERY_URL);
  console.log(galleryInfo);
})();
