module.exports = (req, res, next) => {
    if (req.user  &&  (req.user.email !== 'test@mail.com')) {
        return res.redirect('/products');
    }
    next();
}