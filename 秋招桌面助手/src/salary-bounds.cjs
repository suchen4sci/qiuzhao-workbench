function amount(raw){const m=String(raw??'').trim().match(/^(\d+(?:\.\d+)?)\s*(万|元)?(?:\/月)?$/);return m?Number(m[1])*(m[2]==='万'?10000:1):null;}
module.exports={amount};
