/**
 * htm@v3.1.1
 * https://github.com/developit/htm
 * Licensed under the Apache License 2.0 (see ./htm.LICENSE)
 * Bundle from https://cdnjs.cloudflare.com/ajax/libs/htm/3.1.1/htm.min.js
 */
!function(){function n(n){var t=e.get(this);return t||(t=new Map,e.set(this,t)),1<(t=p(this,t.get(n)||(t.set(n,t=function(n){function t(n){1===u&&(n||(r=r.replace(/^\s*\n\s*|\s*\n\s*$/g,"")))?p.push(0,n,r):3===u&&(n||r)?(p.push(3,n,r),u=2):2===u&&"..."===r&&n?p.push(4,n,0):2===u&&r&&!n?p.push(5,0,!0,r):5<=u&&((r||!n&&5===u)&&(p.push(u,0,r,s),u=6),n&&(p.push(u,n,0,s),u=6)),r=""}for(var e,s,u=1,r="",h="",p=[0],o=0;o<n.length;o++){o&&(1===u&&t(),t(o));for(var a=0;a<n[o].length;a++)e=n[o][a],1===u?"<"===e?(t(),p=[p],u=3):r+=e:4===u?r="--"===r&&">"===e?(u=1,""):e+r[0]:h?e===h?h="":r+=e:'"'===e||"'"===e?h=e:">"===e?(t(),u=1):u&&("="===e?(u=5,s=r,r=""):"/"===e&&(u<5||">"===n[o][a+1])?(t(),3===u&&(p=p[0]),(p=(u=p)[0]).push(2,0,u),u=0):" "===e||"\t"===e||"\n"===e||"\r"===e?(t(),u=2):r+=e),3===u&&"!--"===r&&(u=4,p=p[0])}return t(),p}(n)),t),arguments,[])).length?t:t[0]}var p=function(n,t,e,s){t[0]=0;for(var u=1;u<t.length;u++){var r=t[u++],h=t[u]?(t[0]|=r?1:2,e[t[u++]]):t[++u];3===r?s[0]=h:4===r?s[1]=Object.assign(s[1]||{},h):5===r?(s[1]=s[1]||{})[t[++u]]=h:6===r?s[1][t[++u]]+=h+"":r?(r=n.apply(h,p(n,h,e,["",null])),s.push(r),h[0]?t[0]|=2:(t[u-2]=0,t[u]=r)):s.push(h)}return s},e=new Map;"undefined"!=typeof module?module.exports=n:self.htm=n}();