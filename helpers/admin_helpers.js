const db = require("../config/connection");
const collection = require("../config/collection");
const bcrypt = require("bcrypt");
const objectId = require("mongodb");
const moment = require('moment')

module.exports = {
	doLogin: (adminData) => {
		return new Promise(async (resolve, reject) => {
			let loginStatus = false;
			let response = {};
			let admin = await db.get().collection(collection.ADMIN_COLLECTION).findOne({ email: adminData.email });
			if (admin) {
				await bcrypt.compare(adminData.password, admin.password).then((status) => {
					if (status) {
					
						response.admin = admin;
						response.status = true;
						resolve(response);
					} else {
					
						resolve({ status: false });
					}
				});
			} else {
			
				resolve({ status: false });
			}
		});
	},
	getAllUsers: () => {
		return new Promise(async (resolve, reject) => {
			let users = await db.get().collection(collection.USER_COLLECTION).find().toArray();
			resolve(users);
		});
	},
	blockUser: (userId) => {
		return new Promise((resolve, reject) => {
			db.get()
				.collection(collection.USER_COLLECTION)
				.updateOne(
					{ _id: objectId.ObjectId(userId) },
					{
						$set: {
							userStatus: false,
						},
					}
				)
				.then((user) => {
					resolve();
				});
		});
	},
	unblockUser: (userId) => {
		return new Promise((resolve, reject) => {
			db.get()
				.collection(collection.USER_COLLECTION)
				.updateOne(
					{ _id: objectId.ObjectId(userId) },
					{
						$set: {
							userStatus: true,
						},
					}
				)
				.then((user) => {
					resolve();
				});
		});
	},
	getAllOrders: () => {
		return new Promise(async (resolve, reject) => {
			let orders = await db.get().collection(collection.ORDER_COLLECTION).find().sort({ date: -1 }).toArray();
			resolve(orders);
		});
	},
	shipOrder: (orderId) => {
		return new Promise(async(resolve, reject) => {
			let today = new Date()
			let now = moment(today).format('YYYY-MM-DD')
			let order = await db.get().collection(collection.ORDER_COLLECTION).findOne({_id:objectId.ObjectId(orderId)})
		
			let len = order.products.length
			for(i=0;i<len;i++){
				if(order.products[i].status == "placed" ){
					await db.get().collection(collection.ORDER_COLLECTION).updateOne({_id:objectId.ObjectId(orderId),"products.item":objectId.ObjectId(order.products[i].item)},{
						$set:{
							"products.$.status":"shipped",
							"products.$.isShipped":true,
							"products.$.shippingDate":now,
						}
					})
				}
			}
			if(order.status == "placed"){
				await db.get()
				.collection(collection.ORDER_COLLECTION)
				.updateOne(
					{ _id: objectId.ObjectId(orderId) },
					{
						$set: {
							isShipped: true,
							status: "shipped",
							shippingDate: now,
						},
					}
				)
			}
			
				
					resolve();
			
		});
	},
	deliverOrder: (orderId) => {
		return new Promise(async(resolve, reject) => {
			let today = new Date()
			let expairy = moment(today).add(7,"days").format('YYYY-MM-DD')
			let now = moment(today).format('YYYY-MM-DD')
			let order = await db.get().collection(collection.ORDER_COLLECTION).findOne({_id:objectId.ObjectId(orderId)})
		
			let len = order.products.length
			for(i=0;i<len;i++){
				if(order.products[i].status == "shipped" ){
					await db.get().collection(collection.ORDER_COLLECTION).updateOne({_id:objectId.ObjectId(orderId),"products.item":objectId.ObjectId(order.products[i].item)},{
						$set:{
							"products.$.status":"delivered",
							"products.$.isDelivered":true,
							"products.$.deliveryDate":now,
							"products.$.returnExpairy":expairy,
						}
					})
				}	
			}
			if(order.status == "shipped"){
				await db.get()
				.collection(collection.ORDER_COLLECTION)
				.updateOne(
					{ _id: objectId.ObjectId(orderId) },
					{
						$set: {
							isDelivered: true,
							status: "delivered",
							deliveryDate: now,
							orderValidity: false,
							canBeReturned:true,
							returnExpairy:expairy,
						},
					}
				)
				if(order.paymentMethod == "cod"){
					await db.get().collection(collection.ORDER_COLLECTION).updateOne({_id:objectId.ObjectId(orderId)},{
						$set:{
							payment:"payed the amount",
						}
					})
				}
			}
			
				
					resolve();
				
		});
	},
	
	salesReport: (start,end) => {
		return new Promise(async (resolve, reject) => {
			let orderDelivered= await db.get().collection(collection.ORDER_COLLECTION).find({date:{$gte:start,$lte:end},status:'delivered'}).sort({date:1}).toArray()
			resolve(orderDelivered)
		});
	},
	dashboard:()=>{
		return new Promise(async (resolve, reject) => {
			let orderDelivered= await db.get().collection(collection.ORDER_COLLECTION).find({status:'delivered'}).toArray()
			let orderShipped= await db.get().collection(collection.ORDER_COLLECTION).find({status:"shipped"}).toArray()
			let orderPlaced= await db.get().collection(collection.ORDER_COLLECTION).find({status:"placed"}).toArray()
			let cancelOrder=await db.get().collection(collection.ORDER_COLLECTION).find({status:'canseled'}).toArray()
			let cod =await db.get().collection(collection.ORDER_COLLECTION).find({paymentMethod:"cod",status:"delivered"}).toArray()
			let pal =await db.get().collection(collection.ORDER_COLLECTION).find({paymentMethod:"paypal",status:"delivered"}).toArray()
			let razo = await db.get().collection(collection.ORDER_COLLECTION).find({paymentMethod:"razopay",status:"delivered"}).toArray()
			let wallet = await db.get().collection(collection.ORDER_COLLECTION).find({paymentMethod:"wallet",status:"delivered"}).toArray()
			let orderTotal = await db.get().collection(collection.ORDER_COLLECTION).find().toArray()
			let users = await db.get().collection(collection.USER_COLLECTION).find().toArray()
			let totalAmount = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
					{
						$match: { $and: [{ status: { $ne: "canseled" } }, { payment: { $ne: "pending" } }] },
					},
					{
						$project: {
							_id: 0,
							totalPrice: 1,
						},
					}
						
					
				])
				.toArray();

			let i = totalAmount.length;
			
			let sum = 0;
			for (j = 0; j < i; j++) {
				sum = sum + totalAmount[j].totalPrice[0].total;
			}
			let data = {
				totalSalesAmount:sum,
				delivered:orderDelivered.length,
				placed:orderPlaced.length,
				shipped:orderShipped.length,
				cancel:cancelOrder.length,
				allOrders:orderTotal.length,
				codOrders:cod.length,
				user:users.length,
				paypalOrders:pal.length,
				razopayOrders:razo.length,
				walletOrders:wallet.length,
			}
		
			resolve(data)
		});
	},
	calculateProduct:(prodId)=>{
		return new Promise(async(resolve,reject)=>{
			let product =  await db.get().collection(collection.PRODUCT_COLLECTION).findOne({_id:objectId.ObjectId(prodId)})
		
			let catagory = await db.get().collection(collection.CATAGORY_COLLECTION).findOne({_id:objectId.ObjectId(product.catagory)})
	
			if(product.offerRate == 0 && catagory.catagoryOfferRate == 0){
				checker = false
			}else{
				checker = true
			}
			if(product.offerRate<=catagory.catagoryOfferRate){
		
				let active = catagory.catagoryOfferRate;
				let finalPrice = parseInt((product.price/100)*(100-active))
				await db.get().collection(collection.PRODUCT_COLLECTION).updateOne({_id:objectId.ObjectId(prodId)},{
					$set:{
						activeOffer:parseInt(active),
						offerPrice:parseInt(finalPrice),
						isOfferActive:checker,
					}
				}) 
			}else{
		
				let active = product.offerRate;
				let finalPrice = parseInt((product.price/100)*(100-active))
				await db.get().collection(collection.PRODUCT_COLLECTION).updateOne({_id:objectId.ObjectId(prodId)},{
					$set:{
						activeOffer:parseInt(active),
						offerPrice:parseFloat(finalPrice),
						isOfferActive:checker,
					}
				}) 
			}
			resolve()

		})
	},
	getValidProducts:()=>{
		return new Promise(async(resolve,reject)=>{
			let products =await db.get().collection(collection.PRODUCT_COLLECTION).find({isProductOfferActive:true}).toArray()
			resolve(products)
		})
	},
	shipProduct:(data)=>{
	
		return new Promise(async(resolve,reject)=>{
			await db.get().collection(collection.ORDER_COLLECTION).updateOne({_id:objectId.ObjectId(data.order),"products.item":objectId.ObjectId(data.prodId)},{
				$set:{
					"products.$.status":"shiped",
					"products.$.isShipped":true,
				}
			})
			await db.get().collection(collection.ORDER_COLLECTION).updateOne({_id:objectId.ObjectId(data.order)},{
				$set:{
					status:'shipped'
				}
			})
			resolve()
		})
	},
	deliverProduct:(data)=>{
		return new Promise(async(resolve,reject)=>{
			await db.get().collection(collection.ORDER_COLLECTION).updateOne({_id:objectId.ObjectId(data.order),"products.item":objectId.ObjectId(data.prodId)},{
				$set:{
					"products.$.status":"delivered",
					"products.$.isDelivered":true,
				}
			})
			await db.get().collection(collection.ORDER_COLLECTION).updateOne({_id:objectId.ObjectId(data.order)},{
				$set:{
					status:"delivered"
				}
			})
			resolve()
		})
	}

	
};
