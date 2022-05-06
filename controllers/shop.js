const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_KEY);

const PDFDocument = require('pdfkit');

const ITEMS_PER_PAGE = 3;
let adminUser1 = false;

const Product = require('../models/product');
const Order = require('../models/order');

exports.getProducts = (req, res, next) => {
  const page = +req.query.page ||  1;
  let totalItems;
  if(req.user === undefined){
    adminUser1 = false; 
  }else if(req.user.email === `${process.env.ADMIN_MAIL}`){
    adminUser1 = true;
  }

  Product.find().countDocuments().then(numProducts=>{
    totalItems=numProducts;
    return Product.find()
    .skip((page-1)*ITEMS_PER_PAGE)
    .limit(ITEMS_PER_PAGE)
  })
  .then(products => {
    res.render('shop/product-list', {
      prods: products,
      pageTitle: 'Products',
      path: '/products',
      currentPage:page,
      hasNextPage:ITEMS_PER_PAGE*page<totalItems,
      hasPreviousPage:page>1,
      nextPage:page+1,
      previousPage:page-1,
      lastPage:Math.ceil(totalItems/ITEMS_PER_PAGE),
      adminUser: adminUser1  
    });
  })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  if(req.user === undefined){
    adminUser1 = false; 
  }else if(req.user.email === `${process.env.ADMIN_MAIL}`){
    adminUser1 = true;
  }
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products',
    adminUser: adminUser1
        
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  if(req.user === undefined){
    adminUser1 = false; 
  }else if(req.user.email === `${process.env.ADMIN_MAIL}`){
    adminUser1 = true;
  }
  const page = +req.query.page ||  1;
  let totalItems;
  Product.find().countDocuments().then(numProducts=>{
    totalItems=numProducts;
    return Product.find()
    .skip((page-1)*ITEMS_PER_PAGE)
    .limit(ITEMS_PER_PAGE)
  })
  .then(products => {
    res.render('shop/index', {
      prods: products,
      pageTitle: 'Shop',
      path: '/',
      currentPage:page,
      hasNextPage:ITEMS_PER_PAGE*page<totalItems,
      hasPreviousPage:page>1,
      nextPage:page+1,
      previousPage:page-1,
      lastPage:Math.ceil(totalItems/ITEMS_PER_PAGE),
    adminUser: adminUser1
      
    });
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products,
    adminUser: true ? req.user.email === `${process.env.ADMIN_MAIL}` : false
        
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = (req,res,next)=>{
  let products;
  let total;
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      total=0;
      products = user.cart.items;
      products.forEach(p=>{
        total += p.productId.price*p.quantity;
      });
      return stripe.checkout.sessions.create({
        payment_method_types:['card'],
        line_items:products.map(p=>{
          return {
            name:p.productId.title,
            description:p.productId.description,
            amount:p.productId.price*100,
            currency:'inr',
            quantity:p.quantity
          };
        }),
        success_url:req.protocol+'://'+req.get('host')+'/checkout/success',
        cancel_url:req.protocol+'://'+req.get('host')+'/checkout/cancel'
      });
    })
      .then(session=>{
      res.render('shop/checkout', {
        path: '/checkout',
        pageTitle: 'Payment Maadi',
        products: products,
        totalSum:total,
        sessionId:session.id,
        key:process.env.STRIPE_PUBLIC_KEY,
    adminUser: true ? req.user.email === `${process.env.ADMIN_MAIL}` : false
        
      });
    })  
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders,
    adminUser: true ? req.user.email === `${process.env.ADMIN_MAIL}` : false
        
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};


exports.getInvoice = (req,res,next)=>{
  const orderId = req.params.orderId;

  Order.findById(orderId).then(order=>{
    if(!order){
      return next(new Error('No order found'));
    }

    if(order.user.userId.toString() !== req.user._id.toString()){
      return next(new Error('Not Authorised'));
    }
    // fs.readFile(invoicePath,(err,data)=>{
    //   if(err){
    //     return next(err);
    //   }




    const invoiceName = 'Invoice-'+orderId+'.pdf';
    const invoicePath = path.join('data','invoice',invoiceName);

    const pdfDoc = new PDFDocument();
    res.setHeader('content-Type','application/pdf');
    res.setHeader('content-Disposition','attachment;filename="'+invoiceName+'"');

    pdfDoc.pipe(fs.createWriteStream(invoicePath));
    pdfDoc.pipe(res);
    // const file1 = fs.createReadStream(invoicePath);
    // file1.pipe(res);
    pdfDoc.fontSize(26).text('Invoice',{
      underline:true
    });
    pdfDoc.text('-------------------------------------------');
    let total = 0;
    order.products.forEach(prod=>{
      total += prod.quantity*prod.product.price;
      pdfDoc.fontSize(14).text(prod.product.title+'-'+prod.quantity+'x'+'$'+prod.product.price);
      // pdfDoc.text(prod.product.title+'-'+prod.quantity+'*'+'$'+prod.prodcut.price);
      // pdfDoc.fontSize(14).text('Items');
    });
    pdfDoc.text('Total price: $'+total);
    pdfDoc.end();

  }).catch(err=>{
    next(new Error('Here'));
  }); 
};