const path = require('path');

module.exports = async function handler(req, res) {
  const handlerPath = path.join(process.cwd(), 'divinoburguer', 'api', 'cart', 'add.js');
  delete require.cache[require.resolve(handlerPath)];
  return require(handlerPath)(req, res);
};
