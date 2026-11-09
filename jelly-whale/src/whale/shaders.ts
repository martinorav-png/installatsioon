import * as THREE from 'three';
export const surfaceVertex = /* glsl */`
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vDepth;
  void main(){
    vec4 world=modelMatrix*vec4(position,1.);
    vWorld=world.xyz;
    vNormal=normalize(mat3(modelMatrix)*normal);
    vec4 view=modelViewMatrix*vec4(position,1.);
    vDepth=-view.z;
    gl_Position=projectionMatrix*view;
  }
`;
export const depthVertex = /* glsl */`
 varying float vDepth;varying float vHeight;
 void main(){vec4 v=modelViewMatrix*vec4(position,1.);vDepth=-v.z;vHeight=(modelMatrix*vec4(position,1.)).y;gl_Position=projectionMatrix*v;}
`;
export const shadowFragment = /* glsl */`void main(){gl_FragColor=vec4(gl_FragCoord.z,0.,0.,1.);}`;
export const heightFragment = /* glsl */`varying float vHeight;void main(){gl_FragColor=vec4(vHeight,0.,0.,1.);}`;
export const backFragment = /* glsl */`varying float vDepth;void main(){gl_FragColor=vec4(vDepth,0.,0.,1.);}`;
const neutral = /* glsl */`
 vec3 neutral(vec3 c){
   float start=.76,desaturation=.15;
   float x=min(c.r,min(c.g,c.b));float offset=x<.08?x-6.25*x*x:.04;c-=offset;
   float peak=max(c.r,max(c.g,c.b));if(peak<start)return c;
   float d=1.-start;float np=1.-d*d/(peak+d-start);c*=np/peak;
   float g=1.-1./(desaturation*(peak-np)+1.);return mix(c,vec3(np),g);
 }
`;
export const jellyFragment = /* glsl */`
 uniform sampler2D sceneTexture;
 uniform sampler2D backTexture;
 uniform vec2 resolution;
 uniform vec3 jellyColor;
 uniform float darkness;
 varying vec3 vWorld;
 varying vec3 vNormal;
 varying float vDepth;
 ${neutral}
 float boxLight(vec3 r,vec3 direction,vec3 up,float width,float height){
   vec3 right=normalize(cross(direction,up));up=normalize(cross(right,direction));
   float facing=dot(r,direction);
   vec2 p=vec2(dot(r,right),dot(r,up))/max(.02,facing);
   return (1.-smoothstep(width-.035,width+.06,abs(p.x)))*(1.-smoothstep(height-.035,height+.06,abs(p.y)))*smoothstep(0.,.2,facing);
 }
 float ggx(vec3 n,vec3 v,vec3 l,float rough){vec3 h=normalize(v+l);float ndh=max(dot(n,h),0.),ndv=max(dot(n,v),.001),ndl=max(dot(n,l),0.);float a2=pow(rough,4.);float D=a2/(3.14159*pow(ndh*ndh*(a2-1.)+1.,2.));float k=pow(rough+1.,2.)/8.;float G=ndv/(ndv*(1.-k)+k)*ndl/(ndl*(1.-k)+k);float F=.025+.975*pow(1.-max(dot(v,h),0.),5.);return D*G*F*ndl/max(4.*ndv*ndl,.001);}
 void main(){
   vec3 n=normalize(vNormal),v=normalize(cameraPosition-vWorld);
   float facing=max(dot(n,v),0.);
   vec2 uv=gl_FragCoord.xy/resolution;
   float back=texture2D(backTexture,uv).r;
   float thickness=clamp(back-vDepth,.02,2.5);
   vec3 vn=normalize(mat3(viewMatrix)*n);
   vec2 offset=vn.xy*min(thickness,.95)*.026;
   vec2 refractUv=clamp(uv-offset,vec2(.002),vec2(.998));
   vec3 behind=texture2D(sceneTexture,refractUv).rgb;
   vec3 absorption=vec3(3.0,1.02,.19);
   absorption*=mix(vec3(1.),(vec3(1.)-jellyColor)*1.7,.5);
   vec3 beer=exp(-absorption*(thickness*.85+.21));
   vec3 transmission=behind*beer;
   vec3 tint=jellyColor;
   float lightAmount=1.-darkness*.93;
   vec3 scatter=tint*(.10+.20*max(dot(n,normalize(vec3(-3.,6.,4.))),0.));
   vec3 color=transmission*.87+scatter;
   float fresnel=.027+.973*pow(1.-facing,5.);
   vec3 reflectDir=reflect(-v,n);
   float large=boxLight(reflectDir,normalize(vec3(-.45,1.,.6)),vec3(0.,0.,1.),.72,.25);
   float strip=boxLight(reflectDir,normalize(vec3(.35,.7,-.75)),vec3(0.,1.,0.),.55,.07);
   float edge=boxLight(reflectDir,normalize(vec3(-.9,.5,-.1)),vec3(0.,1.,0.),.16,.9);
   vec3 studio=vec3(.62,.76,.85)*(.23+.28*reflectDir.y)+vec3(1.)*large*3.8+vec3(.77,.9,1.)*strip*2.5+vec3(.8,.94,1.)*edge*1.5;
   color=mix(color,studio,min(.88,fresnel));
   color+=vec3(1.,.99,.97)*large*pow(facing,.4)*.17;
   color+=vec3(.85,.95,1.)*ggx(n,v,normalize(vec3(-3.,6.,4.)),.24)*.6;
   float thin=exp(-thickness*3.5);
   color+=tint*pow(max(dot(-n,normalize(vec3(-3.,6.,4.))),0.),2.)*thin*.18;
   color*=lightAmount;
   color=neutral(max(color,0.));
   gl_FragColor=vec4(color,1.);
   #include <colorspace_fragment>
 }
`;
export const floorVertex=/* glsl */`
 varying vec3 vWorld;
 void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}
`;
export const floorFragment=/* glsl */`
 uniform sampler2D shadowTexture;uniform sampler2D heightTexture;uniform mat4 shadowMatrix;uniform mat4 heightMatrix;
 uniform float darkness;
 varying vec3 vWorld;
 float shadowAt(vec2 uv,float depth,float radius){float s=0.;for(int i=0;i<12;i++){float a=float(i)*2.399963;vec2 d=vec2(cos(a),sin(a))*sqrt((float(i)+.5)/12.)*radius;float z=texture2D(shadowTexture,uv+d).r;s+=step(z+.0008,depth);}return s/12.;}
 void main(){
   vec4 sp=shadowMatrix*vec4(vWorld,1.);vec3 q=sp.xyz/sp.w*.5+.5;
   float blocker=texture2D(shadowTexture,q.xy).r;
   float softness=clamp((q.z-blocker)*.13,.0015,.014);
   float shadow=shadowAt(q.xy,q.z,softness);
   if(q.x<0.||q.x>1.||q.y<0.||q.y>1.)shadow=0.;
   vec4 hp=heightMatrix*vec4(vWorld,1.);vec2 huv=hp.xy/hp.w*.5+.5;
   float ao=0.;
   for(int i=0;i<9;i++){float a=float(i)*2.4;vec2 off=vec2(cos(a),sin(a))*.004;float h=texture2D(heightTexture,huv+off).r;ao+=exp(-max(h-.03,0.)*7.)*step(h,3.);}
   ao/=9.;
   vec3 color=vec3(1.);
   color=mix(color,vec3(.76,.84,.91),shadow*.48);
   color*=1.-ao*.19;
   color=mix(color,vec3(.006,.009,.016)*(1.-ao*.4),darkness);
   gl_FragColor=vec4(color,1.);
 }
`;
export function depthMaterial(fragmentShader:string,side:THREE.Side=THREE.FrontSide){return new THREE.ShaderMaterial({vertexShader:depthVertex,fragmentShader,side});}
