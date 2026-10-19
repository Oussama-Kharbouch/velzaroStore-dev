import {and,eq,gte,inArray,isNotNull,sql} from 'drizzle-orm';
import {revalidatePath} from 'next/cache';
import {shippingFee} from '../../../lib/shipping';
import {getDb,schema} from '../../../db';

const {products,variants,variantSizes,orders,orderItems,orderEvents}=schema;
type RequestedItem={id:string;size:number;qty:number};
class OutOfStock extends Error{}

export async function POST(req:Request){
  try{
    const b=await req.json() as Record<string, unknown>;
    const city=String(b.city||'').trim();
    if(city.length<2||city.length>80||/[\r\n]/.test(city))return Response.json({error:'Choisissez votre ville.'},{status:400});
    const name=String(b.name||'').trim(),address=String(b.address||'').trim(),phone=String(b.phone||'').replace(/[\s().-]/g,'');
    if(name.length<3||name.length>100||address.length<10||address.length>500||!/^(?:(?:\+212|00212)[67]\d{8}|0[67]\d{8})$/.test(phone))return Response.json({error:'Vérifiez votre nom, votre adresse et votre numéro marocain.'},{status:400});
    if(!Array.isArray(b.items)||!b.items.length||b.items.length>20)return Response.json({error:'Votre panier est vide ou trop volumineux.'},{status:400});
    const requested:RequestedItem[]=b.items.map((i:RequestedItem)=>{
      if(typeof i.id!=='string'||!Number.isInteger(i.size)||!Number.isInteger(i.qty)||i.qty<1||i.qty>10)throw Error('article');
      return {id:i.id,size:i.size,qty:i.qty};
    });
    const shipping=shippingFee(city);
    if(shipping===null)return Response.json({error:"Choisissez votre ville."},{status:400});
    const key=String(b.key||'');
    if(!/^[a-f0-9-]{36}$/.test(key))return Response.json({error:'Veuillez réessayer.'},{status:400});

    // Colourways, sizes and prices come from the catalogue in the database, never from the browser.
    const db=getDb();
    const offer=await db.select({sizeId:variantSizes.id,variantId:variants.id,slug:variants.slug,size:variantSizes.size,stock:variantSizes.stock,price:variants.price,colorName:variants.colorName,productName:products.name})
      .from(variantSizes).innerJoin(variants,eq(variantSizes.variantId,variants.id)).innerJoin(products,eq(variants.productId,products.id))
      .where(and(inArray(variants.slug,[...new Set(requested.map(i=>i.id))]),eq(variants.active,true),eq(products.active,true)));
    const lines=requested.map(i=>{
      const match=offer.find(o=>o.slug===i.id&&o.size===i.size);
      if(!match)throw Error('article');
      return {...match,qty:i.qty};
    });
    const subtotal=lines.reduce((s,l)=>s+l.qty*l.price,0);
    const total=subtotal+shipping;
    // The client generates one key per checkout, so a resubmitted order is stored only once.
    const id='VZ-'+key;

    await db.transaction(async tx=>{
      const [order]=await tx.insert(orders).values({orderNumber:id,customerName:name,phone,city,address,subtotal,shippingFee:shipping,total}).onConflictDoNothing({target:orders.orderNumber}).returning({id:orders.id});
      if(!order)return;
      await tx.insert(orderEvents).values({orderId:order.id,kind:'creation',toStatus:'en-attente',message:'Commande passée sur la boutique.'});
      await tx.insert(orderItems).values(lines.map(l=>({orderId:order.id,variantId:l.variantId,productName:l.productName,colorName:l.colorName,size:l.size,quantity:l.qty,unitPrice:l.price})));
      // Sizes with a tracked stock (not null) are decremented; the order fails if there are not enough pairs left.
      for(const l of lines.filter(l=>l.stock!==null)){
        const updated=await tx.update(variantSizes).set({stock:sql`${variantSizes.stock} - ${l.qty}`}).where(and(eq(variantSizes.id,l.sizeId),isNotNull(variantSizes.stock),gte(variantSizes.stock,l.qty))).returning({id:variantSizes.id});
        if(!updated.length)throw new OutOfStock();
      }
    });
    // A tracked size may just have sold out: refresh the shop page.
    if(lines.some(l=>l.stock!==null))revalidatePath('/');
    return Response.json({id,total,subtotal,shipping,city},{status:201});
  }catch(e){
    if(e instanceof OutOfStock)return Response.json({error:'Cette pointure n’est plus disponible.'},{status:409});
    if(!(e instanceof Error&&e.message==='article'))console.error('Order not saved:',e);
    return Response.json({error:'Impossible d’enregistrer la commande. Vérifiez les articles puis réessayez.'},{status:500});
  }
}
