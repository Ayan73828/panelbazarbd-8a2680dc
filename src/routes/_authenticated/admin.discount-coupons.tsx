import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TicketPercent, Plus, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export const Route = createFileRoute("/_authenticated/admin/discount-coupons")({ component: DiscountCouponsPage });
type Coupon = { id:string; code:string; discount_type:"percent"|"fixed"; discount_value:number; min_order:number; max_uses:number; used_count:number; is_active:boolean; expires_at:string|null; created_at:string; product_ids:string[]|null };
function DiscountCouponsPage(){
 const qc=useQueryClient();
 const [code,setCode]=useState(""); const [type,setType]=useState<"percent"|"fixed">("percent"); const [value,setValue]=useState("10"); const [min,setMin]=useState("0"); const [uses,setUses]=useState("100"); const [expiry,setExpiry]=useState(""); const [productIds,setProductIds]=useState<string[]>([]); const [allProducts,setAllProducts]=useState(true); const [busy,setBusy]=useState(false);
 const q=useQuery({queryKey:["admin","discount-coupons"],queryFn:async()=>{const {data,error}=await (supabase as any).rpc("admin_list_discount_coupons");if(error)throw error;return (data??[]) as Coupon[]}});
 const products=useQuery({queryKey:["admin","coupon-product-options"],queryFn:async()=>{const {data,error}=await supabase.from("products").select("id,name,is_active").eq("is_active",true).order("name");if(error)throw error;return data??[]}});
 async function create(){const v=Number(value),m=Number(min),u=Number(uses); if(!allProducts&&productIds.length===0)return toast.error("All products বাছুন অথবা অন্তত একটি product select করুন"); if(!/^[A-Za-z0-9_-]{3,40}$/.test(code.trim()))return toast.error("কুপন কোড ৩–৪০ অক্ষরের দিন");if(!Number.isFinite(v)||v<=0||(type==="percent"&&v>100))return toast.error("সঠিক discount value দিন");if(!Number.isFinite(m)||m<0||!Number.isInteger(u)||u<1)return toast.error("সঠিক minimum order/usage দিন");setBusy(true);try{const {error}=await (supabase as any).rpc("admin_create_discount_coupon",{p_code:code.trim().toUpperCase(),p_discount_type:type,p_discount_value:v,p_min_order:m,p_max_uses:u,p_expires_at:expiry?new Date(expiry).toISOString():null,p_product_ids:allProducts?null:productIds});if(error)throw error;toast.success("Discount coupon তৈরি হয়েছে");setCode("");setProductIds([]);setAllProducts(true);await qc.invalidateQueries({queryKey:["admin","discount-coupons"]});}catch(e){toast.error((e as any)?.message||"কুপন তৈরি হয়নি")}finally{setBusy(false)}}
 async function toggle(c:Coupon){const {error}=await (supabase as any).rpc("admin_toggle_discount_coupon",{p_id:c.id,p_active:!c.is_active});if(error)toast.error(error.message);else{toast.success(c.is_active?"Coupon বন্ধ করা হয়েছে":"Coupon চালু করা হয়েছে");await qc.invalidateQueries({queryKey:["admin","discount-coupons"]})}}
 return <div className="space-y-4"><AdminHeader title="Discount Coupons" description="Website admin থেকে percentage/fixed discount coupon তৈরি ও চালু/বন্ধ করুন।"/>
 <div className="panel space-y-3 p-4"><h2 className="flex items-center gap-2 font-semibold"><TicketPercent className="h-5 w-5 text-primary"/>Create Coupon</h2>
 <label className="block space-y-1 text-sm">Coupon code<Input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" maxLength={40}/></label>
 <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-sm">Discount type<select className="h-10 w-full rounded-md border border-input bg-background px-2" value={type} onChange={e=>setType(e.target.value as any)}><option value="percent">Percentage (%)</option><option value="fixed">Fixed amount (৳)</option></select></label><label className="space-y-1 text-sm">Discount value<Input type="number" min="0.01" value={value} onChange={e=>setValue(e.target.value)}/></label>
 <label className="space-y-1 text-sm">Minimum order (৳)<Input type="number" min="0" value={min} onChange={e=>setMin(e.target.value)}/></label><label className="space-y-1 text-sm">Maximum uses<Input type="number" min="1" value={uses} onChange={e=>setUses(e.target.value)}/></label></div>
 <div className="space-y-2 rounded-lg border border-border p-3">
 <p className="text-sm font-medium">কোন প্রোডাক্টে কুপন চলবে?</p>
 <label className="flex items-center gap-2 text-sm"><input type="radio" name="coupon-scope" checked={allProducts} onChange={()=>setAllProducts(true)}/> All products (সব প্রোডাক্ট)</label>
 <label className="flex items-center gap-2 text-sm"><input type="radio" name="coupon-scope" checked={!allProducts} onChange={()=>setAllProducts(false)}/> Specific products (নির্দিষ্ট প্রোডাক্ট)</label>
 {!allProducts && <div className="max-h-48 space-y-2 overflow-y-auto rounded-md bg-muted/30 p-2">
 {products.isLoading?<p className="text-xs text-muted-foreground">প্রোডাক্ট লোড হচ্ছে…</p>:products.error?<p className="text-xs text-destructive">প্রোডাক্ট লোড হয়নি</p>:(products.data??[]).map(p=><label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={productIds.includes(p.id)} onChange={e=>setProductIds(ids=>e.target.checked?[...ids,p.id]:ids.filter(id=>id!==p.id))}/><span>{p.name}</span></label>)}
 <p className="text-xs text-muted-foreground">{productIds.length}টি প্রোডাক্ট সিলেক্ট করা হয়েছে</p>
 </div>}
 </div>
 <label className="block space-y-1 text-sm">Expiry (optional)<Input type="datetime-local" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
 <Button className="w-full" disabled={busy} onClick={()=>void create()}><Plus className="mr-1 h-4 w-4"/>{busy?"Creating…":"Create Discount Coupon"}</Button></div>
 <div className="space-y-2"><h2 className="font-semibold">Existing Coupons</h2>{q.isLoading?<div className="panel p-4">Loading…</div>:q.error?<div className="panel p-4 text-sm text-destructive">কুপন লোড হয়নি। Admin permission/database migration যাচাই করুন।</div>:(q.data??[]).length===0?<div className="panel p-4 text-sm text-muted-foreground">এখনো কোনো coupon নেই।</div>:(q.data??[]).map(c=><div key={c.id} className="panel space-y-2 p-3"><div className="flex items-center justify-between gap-2"><code className="font-bold">{c.code}</code><Button size="sm" variant="secondary" onClick={()=>void toggle(c)}><Power className="mr-1 h-3 w-3"/>{c.is_active?"Disable":"Enable"}</Button></div><p className="text-sm">{c.discount_type==="percent"?c.discount_value+"% off":"৳"+c.discount_value+" off"} · Min ৳{c.min_order}</p><p className="text-xs text-muted-foreground">{c.product_ids?.length?"Products: "+c.product_ids.map(id=>(products.data??[]).find(p=>p.id===id)?.name??"Selected product").join(", "):"All products"}</p><p className="text-xs text-muted-foreground">Uses {c.used_count}/{c.max_uses} · {c.expires_at?"Expires "+new Date(c.expires_at).toLocaleString():"No expiry"} · {c.is_active?"Active":"Disabled"}</p></div>)}</div></div>
}
