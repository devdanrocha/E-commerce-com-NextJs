import Stripe from 'stripe'
import {v4 as uuidV4 } from 'uuid'
import Cart from '../../models/Cart'
import jwt from 'jsonwebtoken'
import Order from '../../models/Order'
import initDb from '../../helpers/initDB'


initDb()


const stripe = Stripe("sk_test_51IbcBiLfmfzEoMqTAobP7qKUjT5aXXflDhgCrYTZpUDsOwLrYMKVBPMfAvZPdKuLrgvh13y5e0SvURbX1d14hHsf00u9nSUgwE")
export default async (req,res)=>{
    console.log(req.body)
    const {Paymentinfo,email} = req.body
    const {authorization} = req.headers
    if(!authorization){
        return res.status(401).json({error:"you must logged in"})
    }
   
    try{
          const {userId} = jwt.verify(authorization,process.env.JWT_SECRET)    
          const cart = await Cart.findOne({user:userId}).populate("Cart.products.product")
          let price  = 0
          cart.products.forEach(item=>{
            price = price + item.quantity * item.product.price
          })
          const prevCustomer = await stripe.customers.list({
              email:email
          })
          const isExistingCustomer  = prevCustomer.data.length > 0
          let newCustomer
          if(!isExistingCustomer){
               newCustomer =  await stripe.customers.create({
                  email:email,
                  source:Paymentinfo.id
              })
          }

         await stripe.charges.create(
              {
                  currency:"INR",
                  amount: price * 100,
                  receipt_email:email,
                  customer: isExistingCustomer ? prevCustomer.data[0].id : newCustomer.id,
                  description:`you purchased a product | ${email}`
              },{
                idempotencyKey:uuidV4()  
              }
          )
          await new Order({
              user:userId,
              email:email,
              total:price,
              products:cart.products
          }).save()
          await Cart.findOneAndUpdate(
              {_id:cart._id},
              {$set:{products:[]}}
          )
          res.status(200).json({message:"payment was successful"})





         
    }catch(err){
        console.log(err)
        return res.status(401).json({error:"error processing payment"})
    }
   

}