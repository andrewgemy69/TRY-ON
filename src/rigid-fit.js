import canonical from './canonical-face.json';
export const multiply=(a,b)=>{const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;};
const point=(m,x,y,z)=>[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
export function rigidProjection(matrix,landmarks,modelWidth,vw,vh,w,h,mirror,fitState=null,frameTime=0,stockSize=null){
 if(!matrix||!landmarks||!vw||!vh)return null;
 const face=new Float32Array(matrix);
 // MediaPipe canonical face is in centimeters, camera looking along negative Z.
 const eyeLeft=point(face,...canonical[33].map((v,i)=>(v+canonical[133][i])/2)),eyeRight=point(face,...canonical[263].map((v,i)=>(v+canonical[362][i])/2));
 const a=landmarks[33],b=landmarks[133],c=landmarks[362],d=landmarks[263];
 const lx=(a.x+b.x)/2,ly=(a.y+b.y)/2,rx=(c.x+d.x)/2,ry=(c.y+d.y)/2;
 const predicted=Math.hypot(eyeRight[0]/-eyeRight[2]-eyeLeft[0]/-eyeLeft[2],eyeRight[1]/-eyeRight[2]-eyeLeft[1]/-eyeLeft[2]);
 const focal=Math.hypot((rx-lx)*vw,(ry-ly)*vh)/Math.max(predicted,.001);
 if(!Number.isFinite(focal)||focal<=0)return null;
 const anchor=point(face,...canonical[168]),depth=-anchor[2];if(depth<=.1)return null;
 const cover=Math.max(w/vw,h/vh),sign=mirror?-1:1;
 const near=.1,far=1000;
 const projection=new Float32Array([sign*2*focal*cover/w,0,0,0,0,2*focal*cover/h,0,0,0,0,-(far+near)/(far-near),-1,0,0,-2*far*near/(far-near),0]);
 const targetX=sign*(landmarks[168].x-.5)*2*vw*cover/w,targetY=(.5-landmarks[168].y)*2*vh*cover/h;
 projection[8]=sign*2*focal*cover/w*anchor[0]/depth-targetX;
 projection[9]=2*focal*cover/h*anchor[1]/depth-targetY;
 // Estimate this face's width relative to the canonical face at the same pose.
 // Using projected distances compensates for perspective and head rotation.
 const pairs=[[127,356],[234,454]];
 const ratios=pairs.map(([i,j])=>{
  const left=point(face,...canonical[i]),right=point(face,...canonical[j]);
  const expected=focal*Math.hypot(right[0]/-right[2]-left[0]/-left[2],right[1]/-right[2]-left[1]/-left[2]);
  const actual=Math.hypot((landmarks[j].x-landmarks[i].x)*vw,(landmarks[j].y-landmarks[i].y)*vh);
  return expected>5?actual/expected:NaN;
 }).filter(Number.isFinite);
 const widthRatio=ratios.length?ratios.reduce((a,b)=>a+b,0)/ratios.length:1;
 const frontal=Math.abs(face[8])/Math.max(.001,Math.hypot(face[8],face[9],face[10]))<.45;
 const inFrame=pairs.every(pair=>pair.every(i=>landmarks[i].x>.02&&landmarks[i].x<.98&&landmarks[i].y>.02&&landmarks[i].y<.98));
 const candidate=Math.max(.75,Math.min(1.25,widthRatio));
 if(fitState&&fitState.frameTime!==frameTime){
  if(frontal&&inFrame){
   const dt=fitState.frameTime==null?0:Math.max(0,Math.min(.1,frameTime-fitState.frameTime));
   const blend=1-Math.exp(-dt/.6);
   fitState.widthRatio=fitState.widthRatio==null?candidate:fitState.widthRatio+(candidate-fitState.widthRatio)*blend;
  }
  fitState.frameTime=frameTime;
 }
 // Hold the person's learned width during side views; position and rotation still track.
 const personalWidth=fitState?.widthRatio??candidate;
 const scale=(canonical[356][0]-canonical[127][0])*personalWidth*(stockSize?stockSize.frameWidth/stockSize.faceWidth:1)/modelWidth;
 const mount=new Float32Array([scale,0,0,0,0,scale,0,0,0,0,scale,0,...canonical[168],1]);
 const model=multiply(face,mount);
 return {mvp:multiply(projection,model),model,depth,focal,projection};
}
