import { clamp, pouchDisplacement, smooth, type Lattice } from './shape';
import { bindSmoothSkin, skinSmoothSurface, type SkinBinding } from './skinning';
const floorHeight = Math.fround(.022);
export type Binding = { ids: [number,number,number,number]; weights: [number,number,number,number] };
export type { SkinBinding } from './skinning';
export class SoftWhale {
  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  readonly rest: Float32Array;
  readonly tets: Uint32Array;
  readonly displacement: Float32Array;
  private previous: Float32Array;
  private candidate: Float32Array;
  private minimumVolumes: Float32Array;
  private target: Float32Array;
  private edges: Uint32Array;
  private edgeRest: Float32Array;
  private edgeCompliance: Float32Array;
  private volumes: Float32Array;
  private inverse: Float32Array;
  private lastInflation = -1;
  private grabWeights: Float32Array;
  private grabOrigin = [0,0,0];
  grab: { target: number[]; twist: number } | null = null;
  firmness = 1;
  damping = 1.5;
  speedLimit = 2.4;
  constructor(readonly lattice: Lattice) {
    this.rest = lattice.rest; this.tets = lattice.tets;
    this.positions = this.rest.slice(); this.previous = this.rest.slice(); this.candidate = this.rest.slice(); this.target = this.rest.slice();
    this.velocities = new Float32Array(this.rest.length); this.displacement = new Float32Array(this.rest.length);
    this.grabWeights = new Float32Array(this.rest.length/3);
    for(let i=0;i<this.rest.length;i+=3) this.displacement.set(pouchDisplacement(this.rest[i],this.rest[i+1],this.rest[i+2]),i);
    const edgeSet = new Set<number>(),count=this.rest.length/3;
    for(let t=0;t<this.tets.length;t+=4) for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){
      const u=this.tets[t+a],v=this.tets[t+b];edgeSet.add(Math.min(u,v)*count+Math.max(u,v));
    }
    this.edges=new Uint32Array(edgeSet.size*2);let e=0;
    edgeSet.forEach(key=>{this.edges[e++]=Math.floor(key/count)*3;this.edges[e++]=(key%count)*3;});
    this.edgeRest=new Float32Array(edgeSet.size); this.edgeCompliance=new Float32Array(edgeSet.size);
    for(let i=0;i<this.edgeRest.length;i++){
      const a=this.edges[i*2],b=this.edges[i*2+1];
      const x=(this.rest[a]+this.rest[b])/2,y=(this.rest[a+1]+this.rest[b+1])/2,z=(this.rest[a+2]+this.rest[b+2])/2;
      this.edgeCompliance[i]=Math.abs(z)>.8||x>1.8 ? 0.000000025 : y>.9 ? 0.00000015 : x<-.7&&y<.7 ? 0.0000014 : 0.00000055;
    }
    this.volumes=new Float32Array(this.tets.length/4);
    this.inverse=new Float32Array(this.tets.length/4*12);
    for(let t=0;t<this.tets.length;t+=4){
      const a=this.tets[t]*3,b=this.tets[t+1]*3,c=this.tets[t+2]*3,d=this.tets[t+3]*3,r=this.rest;
      const ax=r[b]-r[a],ay=r[b+1]-r[a+1],az=r[b+2]-r[a+2],bx=r[c]-r[a],by=r[c+1]-r[a+1],bz=r[c+2]-r[a+2],cx=r[d]-r[a],cy=r[d+1]-r[a+1],cz=r[d+2]-r[a+2];
      const det=ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx),o=t/4*12;
      this.inverse.set([(by*cz-bz*cy)/det,(bz*cx-bx*cz)/det,(bx*cy-by*cx)/det,(cy*az-cz*ay)/det,(cz*ax-cx*az)/det,(cx*ay-cy*ax)/det,(ay*bz-az*by)/det,(az*bx-ax*bz)/det,(ax*by-ay*bx)/det,r[a],r[a+1],r[a+2]],o);
    }
    this.minimumVolumes = new Float32Array(this.tets.length / 4);
    for (let t = 0; t < this.tets.length; t += 4) this.minimumVolumes[t / 4] = this.tetVolume(this.rest, t) * .05;
    this.updateRest(0);
  }
  private updateRest(inflation:number){
    if(Math.abs(inflation-this.lastInflation)<0.00001)return;
    this.lastInflation=inflation;
    for(let i=0;i<this.rest.length;i+=3){
      const x=this.rest[i];
      const reaction=.35*inflation*smooth(-2.6,-2.1,x)*(1-smooth(-.7,0,x));
      this.target[i]=this.rest[i]+this.displacement[i]*inflation;
      this.target[i+1]=this.rest[i+1]+this.displacement[i+1]*inflation+reaction;
      this.target[i+2]=this.rest[i+2]+this.displacement[i+2]*inflation;
    }
    for(let e=0;e<this.edgeRest.length;e++){
      const a=this.edges[e*2],b=this.edges[e*2+1],r=this.target;
      this.edgeRest[e]=Math.hypot(r[a]-r[b],r[a+1]-r[b+1],r[a+2]-r[b+2]);
    }
    for(let t=0;t<this.tets.length;t+=4)this.volumes[t/4]=this.tetVolume(this.target,t);
  }
  private tetVolume(p:Float32Array,t:number){
    const a=this.tets[t]*3,b=this.tets[t+1]*3,c=this.tets[t+2]*3,d=this.tets[t+3]*3;
    const ax=p[b]-p[a],ay=p[b+1]-p[a+1],az=p[b+2]-p[a+2],bx=p[c]-p[a],by=p[c+1]-p[a+1],bz=p[c+2]-p[a+2],cx=p[d]-p[a],cy=p[d+1]-p[a+1],cz=p[d+2]-p[a+2];
    return (ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;
  }
  volume(){let v=0;for(let t=0;t<this.tets.length;t+=4)v+=this.tetVolume(this.positions,t);return v;}
  reset(){this.positions.set(this.rest);this.velocities.fill(0);this.grab=null;this.lastInflation=-1;this.updateRest(0);}
  impulse(x:number,y:number,z:number,origin?:readonly[number,number,number]){
    for(let i=0;i<this.velocities.length;i+=3){
      const weight=origin?Math.exp(-((this.positions[i]-origin[0])**2+(this.positions[i+1]-origin[1])**2+(this.positions[i+2]-origin[2])**2)/.8):1;
      this.velocities[i]+=x*weight;this.velocities[i+1]+=y*weight;this.velocities[i+2]+=z*weight;
    }
  }
  startGrab(x:number,y:number,z:number){
    this.grabOrigin=[x,y,z];this.grab={target:[x,y,z],twist:0};
    for(let i=0;i<this.positions.length;i+=3){const d=(this.positions[i]-x)**2+(this.positions[i+1]-y)**2+(this.positions[i+2]-z)**2;this.grabWeights[i/3]=Math.exp(-d/0.22);}
  }
  private preserveOrientation() {
    const p = this.positions;
    // Repair only the cells that approach inversion. Returning the entire body
    // to rest here cancels a held pull, including its upward displacement.
    for (let pass = 0; pass < 6; pass++) {
      let corrected = false;
      for (let i = 1; i < p.length; i += 3) {
        if (p[i] < floorHeight) {p[i] = floorHeight;corrected = true;}
      }
      for (let t = 0; t < this.tets.length; t += 4) {
        // Leave a wider recovery margin when free: cells sitting against the
        // validation barrier can otherwise keep rolling back to a pinched pose.
        const minimum = this.minimumVolumes[t / 4] * (this.grab ? 1.05 : 2);
        const volume = this.tetVolume(p, t);
        if (volume >= minimum) continue;
        corrected = true;
        const a=this.tets[t]*3,b=this.tets[t+1]*3,c=this.tets[t+2]*3,d=this.tets[t+3]*3;
        const ax=p[b]-p[a],ay=p[b+1]-p[a+1],az=p[b+2]-p[a+2],bx=p[c]-p[a],by=p[c+1]-p[a+1],bz=p[c+2]-p[a+2],cx=p[d]-p[a],cy=p[d+1]-p[a+1],cz=p[d+2]-p[a+2];
        const g1x=(by*cz-bz*cy)/6,g1y=(bz*cx-bx*cz)/6,g1z=(bx*cy-by*cx)/6;
        const g2x=(cy*az-cz*ay)/6,g2y=(cz*ax-cx*az)/6,g2z=(cx*ay-cy*ax)/6;
        const g3x=(ay*bz-az*by)/6,g3y=(az*bx-ax*bz)/6,g3z=(ax*by-ay*bx)/6;
        const g0x=-g1x-g2x-g3x,g0y=-g1y-g2y-g3y,g0z=-g1z-g2z-g3z;
        const norm=g0x*g0x+g0y*g0y+g0z*g0z+g1x*g1x+g1y*g1y+g1z*g1z+g2x*g2x+g2y*g2y+g2z*g2z+g3x*g3x+g3y*g3y+g3z*g3z;
        const s=(minimum-volume)/(norm+1e-20);
        p[a]+=s*g0x;p[a+1]+=s*g0y;p[a+2]+=s*g0z;
        p[b]+=s*g1x;p[b+1]+=s*g1y;p[b+2]+=s*g1z;
        p[c]+=s*g2x;p[c+1]+=s*g2y;p[c+2]+=s*g2z;
        p[d]+=s*g3x;p[d+1]+=s*g3y;p[d+2]+=s*g3z;
      }
      if (!corrected) return;
    }
    // Extremely thin boundary cells can defeat the gradient projection. Roll
    // back only their four vertices, then repair any affected neighbours.
    for (let pass = 0; pass < 12; pass++) {
      let repaired = false;
      for (let i = 1; i < p.length; i += 3) {
        if (p[i] < floorHeight) {p[i] = floorHeight;repaired = true;}
      }
      for (let t = 0; t < this.tets.length; t += 4) {
        if (this.tetVolume(p, t) >= this.minimumVolumes[t / 4]) continue;
        repaired = true;
        for (let j = 0; j < 4; j++) {
          const o = this.tets[t + j] * 3;
          p[o] = this.previous[o];p[o + 1] = this.previous[o + 1];p[o + 2] = this.previous[o + 2];
        }
      }
      if (!repaired) return;
    }
    const valid = () => {
      for (let i = 1; i < p.length; i += 3) if (!(p[i] >= floorHeight)) return false;
      for (let t = 0; t < this.tets.length; t += 4) {
        if (!(this.tetVolume(p, t) >= this.minimumVolumes[t / 4])) return false;
      }
      return true;
    };
    if (valid()) return;
    // If neighbouring corrections still conflict, shorten this substep from
    // its last valid pose. Never pull the sculpture back to its original pose.
    this.candidate.set(p);
    for (let fraction = .5; fraction > .0001; fraction *= .5) {
      for (let i = 0; i < p.length; i++) p[i] = this.previous[i] + (this.candidate[i] - this.previous[i]) * fraction;
      if (valid()) return;
    }
    p.set(this.previous);
  }
  step(dt:number,inflation:number){
    this.updateRest(clamp(inflation));
    const h=dt/10,p=this.positions,v=this.velocities,prev=this.previous,r=this.target;
    const decay=Math.exp(-2*this.damping*h),invH2=1/(h*h),volumeAlpha=1.5e-11*Math.pow(this.lattice.h/.24,4)*invH2/this.firmness;
    for(let sub=0;sub<10;sub++){
      prev.set(p);
      for(let i=0;i<p.length;i+=3){
        // Gentle shape memory prevents whole-body creep without pinning the belly.
        const lift=0;
        v[i]=(v[i]+(r[i]-p[i])*32*h)*decay;
        v[i+1]=(v[i+1]+((r[i+1]+lift-p[i+1])*32-1.2)*h)*decay;
        v[i+2]=(v[i+2]+(r[i+2]-p[i+2])*32*h)*decay;
        p[i]+=v[i]*h;p[i+1]+=v[i+1]*h;p[i+2]+=v[i+2]*h;
      }
      for(let e=0;e<this.edgeRest.length;e++){
        const a=this.edges[e*2],b=this.edges[e*2+1];
        const dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2],len=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-8;
        const alpha=this.edgeCompliance[e]*invH2/this.firmness;
        const s=(len-this.edgeRest[e])/(len*(2+alpha));
        p[a]+=dx*s;p[a+1]+=dy*s;p[a+2]+=dz*s;p[b]-=dx*s;p[b+1]-=dy*s;p[b+2]-=dz*s;
      }
      // Shape recovery is already integrated as a spring above. A second
      // positional tether here becomes an extremely stiff spring at 600 Hz.
      for(let t=0;t<this.tets.length;t+=4){
        const a=this.tets[t]*3,b=this.tets[t+1]*3,c=this.tets[t+2]*3,d=this.tets[t+3]*3;
        const ax=p[b]-p[a],ay=p[b+1]-p[a+1],az=p[b+2]-p[a+2],bx=p[c]-p[a],by=p[c+1]-p[a+1],bz=p[c+2]-p[a+2],cx=p[d]-p[a],cy=p[d+1]-p[a+1],cz=p[d+2]-p[a+2];
        const g1x=(by*cz-bz*cy)/6,g1y=(bz*cx-bx*cz)/6,g1z=(bx*cy-by*cx)/6;
        const g2x=(cy*az-cz*ay)/6,g2y=(cz*ax-cx*az)/6,g2z=(cx*ay-cy*ax)/6;
        const g3x=(ay*bz-az*by)/6,g3y=(az*bx-ax*bz)/6,g3z=(ax*by-ay*bx)/6;
        const g0x=-g1x-g2x-g3x,g0y=-g1y-g2y-g3y,g0z=-g1z-g2z-g3z;
        const volume=(ax*g1x+ay*g1y+az*g1z);
        const denom=g0x*g0x+g0y*g0y+g0z*g0z+g1x*g1x+g1y*g1y+g1z*g1z+g2x*g2x+g2y*g2y+g2z*g2z+g3x*g3x+g3y*g3y+g3z*g3z+volumeAlpha;
        const s=clamp((volume-this.volumes[t/4])/denom,-0.1,0.1);
        p[a]-=s*g0x;p[a+1]-=s*g0y;p[a+2]-=s*g0z;
        p[b]-=s*g1x;p[b+1]-=s*g1y;p[b+2]-=s*g1z;
        p[c]-=s*g2x;p[c+1]-=s*g2y;p[c+2]-=s*g2z;
        p[d]-=s*g3x;p[d+1]-=s*g3y;p[d+2]-=s*g3z;
      }
      if(this.grab){
        const g=this.grab,o=this.grabOrigin,cs=Math.cos(g.twist),sn=Math.sin(g.twist);
        for(let i=0;i<p.length;i+=3){const w=this.grabWeights[i/3]*.28;if(w<.0002)continue;
          const rx=this.rest[i]-o[0],rz=this.rest[i+2]-o[2];
          p[i]+=(r[i]+g.target[0]-o[0]+rx*(cs-1)-rz*sn-p[i])*w;
          p[i+1]+=(r[i+1]+g.target[1]-o[1]-p[i+1])*w;
          p[i+2]+=(r[i+2]+g.target[2]-o[2]+rx*sn+rz*(cs-1)-p[i+2])*w;
        }
      }
      for(let i=0;i<p.length;i+=3){
        if(p[i+1]<floorHeight){p[i+1]=floorHeight;p[i]+=(prev[i]-p[i])*.12;p[i+2]+=(prev[i+2]-p[i+2])*.12;}
      }
      this.preserveOrientation();
      for(let i=0;i<p.length;i+=3){
        const vx=(p[i]-prev[i])/h,vy=(p[i+1]-prev[i+1])/h,vz=(p[i+2]-prev[i+2])/h;
        // Pointer targets are discontinuous; do not turn their correction into
        // unbounded release momentum in the smallest boundary cells.
        const scale=Math.min(1,this.speedLimit/(Math.hypot(vx,vy,vz)||1));
        // Constraint repair is positional stabilization, not an elastic impact.
        // Retain the integrated momentum and only partially transfer its
        // correction into velocity, so tiny cell repairs cannot pump energy.
        v[i]=v[i]*.8+vx*scale*.2;v[i+1]=v[i+1]*.8+vy*scale*.2;v[i+2]=v[i+2]*.8+vz*scale*.2;
      }
    }
  }
  embed(x:number,y:number,z:number):Binding{
    const h=this.lattice.h,ci=Math.floor(x/h),cj=Math.floor(y/h),ck=Math.floor(z/h),m=this.inverse;
    let best=-1,score=Infinity,bw:[number,number,number,number]=[1,0,0,0];
    for(let radius=1;radius<=3&&best<0;radius++){
      for(let i=ci-radius;i<=ci+radius;i++)for(let j=cj-radius;j<=cj+radius;j++)for(let k=ck-radius;k<=ck+radius;k++){
        const ts=this.lattice.cellTets.get(`${i},${j},${k}`);if(!ts)continue;
        for(const t of ts){const o=t*12,dx=x-m[o+9],dy=y-m[o+10],dz=z-m[o+11];
          const b=m[o]*dx+m[o+1]*dy+m[o+2]*dz,c=m[o+3]*dx+m[o+4]*dy+m[o+5]*dz,d=m[o+6]*dx+m[o+7]*dy+m[o+8]*dz,a=1-b-c-d;
          const penalty=Math.max(0,-a)+Math.max(0,-b)+Math.max(0,-c)+Math.max(0,-d);
          if(penalty<score){score=penalty;best=t;bw=[a,b,c,d];}
          if(penalty<1e-5)break;
        }
      }
    }
    if(best<0){let nearest=0,distance=Infinity;for(let i=0;i<this.rest.length;i+=3){const d=(this.rest[i]-x)**2+(this.rest[i+1]-y)**2+(this.rest[i+2]-z)**2;if(d<distance){distance=d;nearest=i/3;}}return {ids:[nearest,nearest,nearest,nearest],weights:[1,0,0,0]};}
    return {ids:[this.tets[best*4],this.tets[best*4+1],this.tets[best*4+2],this.tets[best*4+3]],weights:bw};
  }
  evaluate(binding:Binding):[number,number,number]{const p=this.positions,r:[number,number,number]=[0,0,0];for(let i=0;i<4;i++){const o=binding.ids[i]*3,w=binding.weights[i];r[0]+=p[o]*w;r[1]+=p[o+1]*w;r[2]+=p[o+2]*w;}return r;}
  bind(points:Float32Array):SkinBinding{
    return bindSmoothSkin(this.rest,points,this.lattice.h);
  }
  skin(binding:SkinBinding,result:Float32Array){
    skinSmoothSurface(binding,this.rest,this.positions,result);
  }
}
