const handlers = {
  'card-attempts': require('../../divinoburguer/api/admin/card-attempts'),
  login: require('../../divinoburguer/api/admin/login'),
  logout: require('../../divinoburguer/api/admin/logout'),
  session: require('../../divinoburguer/api/admin/session')
};

module.exports = async function handler(req, res) {
  const action = Array.isArray(req.query?.action)
    ? req.query.action[0]
    : req.query?.action;
  const actionHandler = handlers[action];

  if (!actionHandler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ message: 'Rota administrativa nao encontrada.' }));
  }

  return actionHandler(req, res);
};
