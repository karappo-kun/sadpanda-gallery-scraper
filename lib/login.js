let request = require('request-promise-native');
const $ = require('cheerio');

const jar = request.jar();
request = request.defaults({ jar });

const transform = body => $.load(body);
// const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function login() {
  let response;

  response = await request({
    uri: 'https://forums.e-hentai.org/index.php?act=Login&CODE=00',
    transform,
  });

  const formToken = response('form input[type="hidden"]')
    .get()
    .reduce(
      (acc, el) => ({ ...acc, [$(el).attr('name')]: $(el).attr('value') }),
      {},
    );

  const formAction = response('form').attr('action');

  const loginParam = {
    ...formToken,
    UserName: process.env.SADPANDA_USER,
    PassWord: process.env.SADPANDA_PASS,
    CookieDate: 1,
  };

  response = await request({
    uri: formAction,
    method: 'POST',
    form: { ...loginParam },
  });

  const isLoginSuccess = response.includes(
    `You are now logged in as: ${process.env.SADPANDA_USER}`,
  );

  if (!isLoginSuccess) throw new Error('Login failed');

  const navbar = await request({
    uri: 'https://exhentai.org/',
    transform,
  });

  const isExhentaiLogin = navbar('div#nb.nosel').get().length >= 1;
  if (!isExhentaiLogin) throw new Error('Login failed');

  await request('https://exhentai.org/');

  return request;
}

module.exports = { login, jar };
