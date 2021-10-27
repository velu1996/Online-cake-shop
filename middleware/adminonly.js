module.exports = (req, res, next) => {
    if (req.user.email !== 'test@mail.com') {
        return res.redirect('/');
    }
    next();
}