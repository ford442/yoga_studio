//  The original non-translated GLSL shader

#define PI 3.141592
#define TAU 	(PI * 2.0)
#define HEX_COS (0.86602540378443 * 0.5)
#define HEX_TAN (0.57735026918962 * 0.5)
#define SIN(x) (sin(x)*.5+.5)
#define LINE_WIDTH 0.0001
#define MESH_DENSITY 90.
#define LAYER_DISTANCE 6.5
#define hue(v) ( .6 + .6 * cos( 6.3*(v) + vec3(0,23,21) ) )

// yoga strength setting
int strengthLevel=0; // light
// int strengthLevel=1; // medium
// int strengthLevel=2; // strong

#define ch(l) x=min(x,l(uv+vec2(spacing.x*nr, 0.)));nr-=size.x;
#define a_ ch(aa);
#define b_ ch(bb);
#define c_ ch(cc);
#define d_ ch(dd);
#define e_ ch(ee);
#define f_ ch(ff);
#define g_ ch(gg);
#define h_ ch(hh);
#define i_ ch(ii);
#define j_ ch(jj);
#define k_ ch(kk);
#define l_ ch(ll);
#define m_ ch(mm);
#define n_ ch(nn);
#define o_ ch(oo);
#define p_ ch(pp);
#define q_ ch(qq);
#define r_ ch(rr);
#define s_ ch(ss);
#define t_ ch(tt_);
#define u_ ch(uu);
#define v_ ch(vv);
#define w_ ch(ww);
#define x_ ch(xx);
#define y_ ch(yy);
#define z_ ch(zz);
#define brR ch(bracketRight);
#define brL ch(bracketLeft);
#define sc ch(semicolon);
//Space
#define _ nr--;
//Space
#define _half nr-=.5;
#define _quar nr-=.25;
//Next line
#define crlf uv.y += spacing.w; nr = 0.;

#define line1 _ c_ o_ s_ brR m_ o_ s_ brL sc crlf e_ t_ h_ e_ r_ e_ a_ l_ n_ e_ t_
#define line2 _ _ _half _quar b_ r_ e_ a_ t_ h_ _half i_ n_
#define line3 _ _half _ b_ r_ e_ a_ t_ h_ _half o_ u_ t_
#define line4 _ _ _quar h_ o_ l_ d_ _half b_ r_ e_ a_ t_ h_
#define line5 _ _ e_ n_ d_ _half o_ f_ _half c_ y_ c_ l_ e_
#define line6 crlf _ _ _half r_ a_ i_ s_ e_ _half a_ r_ m_ s_
#define line7 crlf _ _ _half l_ o_ w_ e_ r_ _half a_ r_ m_ s_
#define line8 crlf _ _ _ _ f_ l_ e_ x_
#define line9 crlf _ _ _ _ r_ e_ l_ a_ x_

const int iterations =32;
const float dist_eps = .0001;
const float ray_max = 400.0;
const float fog_density = 0.01;
float fField(vec3 p);

uvec4[10] char_numbers=uvec4[10](
uvec4(0x7FBFFC0F,0x03C0F33C,0xCF03C0F0,0x3FFDFE00),
uvec4(0x1C0F07C3,0xB0CC0300,0xC0300C03,0x0FFFFF00),
uvec4(0x7FBFFC0F,0x0301C0E0,0x70381C0E,0x0FFFFF00),
uvec4(0x7FBFFC0C,0x0300C3E0,0xF80300F0,0x3FFDFE00),
uvec4(0x30DC360F,0x83C0FFFF,0xFC0300C0,0x300C0300),
uvec4(0xFFFFFC03,0x00C03FEF,0xFC0300C0,0x3FFFFE00),
uvec4(0x7FFFFC03,0x00C03FEF,0xFF03C0F0,0x3FFDFE00),
uvec4(0xFFFFF00C,0x070180E0,0x301C0601,0x80601800),
uvec4(0x7FBFFC0F,0x03C0DFE7,0xFB03C0F0,0x3FFDFE00),
uvec4(0x7FFFFC0F,0x03C0FFF7,0xFC0300C0,0x300C0300)
);

uvec4 char_dash=uvec4(0x00000000,0x00003FFF,0xFC000000,0x00000000);
uvec4 char_period=uvec4(0x00000000,0x00000000,0x00000000,0x00C03000);

uint _O(uint v,uint p){
    return((v<<p)&0x80000000u)>>31;
}

int D(vec2 p, float n) {
    int i=int(p.y),b=int(exp2(floor(30.-p.x-n*3.)));
    i = ( p.x<0.||p.x>3.? 0:i==5? 972980223: i==4? 690407533: i==3? 704642687: i==2? 696556137:i==1? 972881535: 0 )/b;
    return i-i/2*2;
}

int glyph(uvec4 a,float b,vec2 c,vec2 d){
    vec2 e=d-c;e/=b;
    e.y=12.-e.y;
    if(0.>e.x||e.x>=10.||0.>e.y||e.y>=12.){
        return 0;
    }
    uvec2 f=uvec2(e);
    uint g=f.x+10u*f.y,h;
    if(g<32u){h=_O(a.x,g);
    }else if(g<64u){
        h=_O(a.y,g-32u);
    }else if(g<96u){
        h=_O(a.z,g-64u);
    }else{
        h=_O(a.w,g-96u);
    }
    return int(h);
}

int number(in float number,in int places,in float scale,in vec2 pos,in vec2 fragCoord){
    float mx=12.*scale;
    int px=0;
    if(number<0.0){
        px +=glyph(char_dash,scale,pos,fragCoord);
        pos.x+=mx;
        number*=-1.0;
    }
    number=round(number*pow(10.0,float(places)));
    int[20] numlist;
    int numlistLen=0;
    for(;number>=1.0;number/=10.0){
        numlist[numlistLen]=int(mod(number,10.0));
        numlistLen++;
    }
    if(numlistLen<places+1){

        if(numlistLen<1){
            px+=glyph(char_numbers[0],scale,pos,fragCoord);
            pos.x+=mx;
        }
    }
    for(int i=numlistLen-1;i>=0;i--){
        px+=glyph(char_numbers[numlist[i]],scale,pos,fragCoord);
        pos.x+=mx;
    }
    return px>0?1:0;
}

float tt, g_mat, bd;
vec3 ro;

mat2 rot2(float a) {
    return mat2(cos(a), sin(a), -sin(a), cos(a));
}

float dHex(vec2 p) {
    p = abs(p);
    float c = dot(p, normalize(vec2(1, 1.73)));
    return max(c, p.x);
}

float dTri(vec2 p) {
    float a = atan(p.x,p.y)+PI;
    float r = TAU/float(3);
    float d = cos(floor(.5+a/r)*r-a)*length(p);
    return d;
}

float hexRing(vec2 p, float r, float s, float blur) {
    float d = dHex(p) - r ;
    float c = 1.-smoothstep(0., s, abs(d)-blur);
    return c;
}

float triRing(vec2 p, float r, float s, float blur) {
    float d = dTri(p) - r ;
    float c = 1.-smoothstep(0., s, abs(d)-blur);
    return c;
}

float ring(vec2 p, float r, float s, float blur) {
    float d = length(p) - r ;
    float c = 1.-smoothstep(0., s, abs(d)-blur);
    return c;
}

vec2 pmod(vec2 pos, float num, out float id){
    float angle = atan(pos.x, pos.y) + PI / num;
    float split = TAU / num;
    id = floor(angle / split);
    angle = id * split;
    return rot2(angle) * pos;
}

float curve(float t, float d) {
    t/=d;
    return mix(floor(t), floor(t)+1., pow(smoothstep(0.,1.,fract(t)), 20.));
}

vec3 repeat(inout vec3 p, vec3 size) {
    vec3 c = floor((p + size*0.5)/size);
    p = mod(p + size*0.5, size) - size*0.5;
    return c;
}

float repeat(inout float p, float size) {
    float c = floor((p + size*0.5)/size);
    p = mod(p + size*0.5, size) - size*0.5;
    return c;
}

float sdPill( vec3 p, vec3 a, vec3 b, float r )
{
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h ) - r;
}

void mapStars(vec2 uv, out vec3 near, out vec3 neighbor)
{
    vec2 point;
    near = vec3(1e+4);
    for(float y=-1.0; y<=1.0; y+=2.0)
    {
        point = vec2(0.0, HEX_COS + y * HEX_TAN * 0.25);
        float dist = distance(uv, point);
        near = near.z < dist ? near : vec3(point, dist);
    }
    for(float x=-1.0; x<=1.0; x+=2.0)
    {
        for(float y=-1.0; y<=1.0; y+=2.0)
        {
            for(float both=-1.0; both<=1.0; both+=2.0)
            {
                point = vec2(x * 0.125, HEX_COS + y * HEX_COS * 0.5);
                point.x += both * 0.5 * 0.125 * -x;
                point.y += both * HEX_TAN * 0.125 * -y;
                float dist = distance(uv, point);
                near = near.z < dist ? near : vec3(point, dist);
            }
        }
    }
    neighbor = vec3(1e+4);
    for(float y=-1.0; y<=1.0; y+=2.0)
    {
        point = vec2(0.0, HEX_COS + y * HEX_TAN * 0.25);
        if(near.xy != point)
        {
            vec2 center = (point + near.xy) * 0.5;
            float dist = dot(uv - center, normalize(near.xy - point));
            neighbor = neighbor.z < dist ? neighbor : vec3(point, dist);
        }
    }
    for(float x=-1.0; x<=1.0; x+=2.0)
    {
        for(float y=-1.0; y<=1.0; y+=2.0)
        {
            for(float both=-1.0; both<=1.0; both+=2.0)
            {
                point = vec2(x * 0.125, HEX_COS + y * HEX_COS * 0.5);
                point.x += both * 0.5 * 0.125 * -x;
                point.y += both * HEX_TAN * 0.125 * -y;
                if(near.xy != point)
                {
                    vec2 center = (point + near.xy) * 0.5;
                    float dist = dot(uv - center, normalize(near.xy - point));
                    neighbor = neighbor.z < dist ? neighbor : vec3(point, dist);
                }
            }
        }
    }
}

vec2 toLogPolar(vec2 p) {
    return vec2(log(length(p)), atan(p.y/p.x));
}

float starPattern(vec2 uv) {
    vec2 uvb = uv;
    float width = 0.0001 + mix(0.03, 0., pow(dot(uv, uv), .3));
    uv = toLogPolar(uv*.01)*2.5;
    uv.x += -.2*tt;
    uv = vec2(mod(uv.x, 1.0) - 0.5,
    mod(uv.y, HEX_COS * 2.0) - HEX_COS);
    float id;
    float reps = 5.;
    float t = .07*(tt+6.);
    float modid = (mod(floor(.1*length(uv)-t), reps)+3.)*2.;
    float modt = pow(smoothstep(.0, .3, abs(fract(.1*length(uvb)-t)-.5)), 500.);
    float alpha = mix(6., 18., modt);
    uv = pmod(uv, alpha, id);
    vec3 near, neighbor;
    mapStars(uv, near, neighbor);
    float line = (1.0 - smoothstep(0.0, width, neighbor.z));
    return line;
}


vec3 kalei(vec3 p) {
    p.x = abs(p.x) - 2.5;
    vec3 q = p;
    q.y -= .5;
    q.y += .4*sin(tt);
    p.y += .3*sin(p.z*3.+.5*tt);
    float at = length(q) - .01;
    for(float i=0.; i < 6.; i++) {
        p.x = abs(p.x) - 1.5;
        p.xz *= rot2(1.-exp(-p.z*.14*i)+.2*tt+.1*at);
        p.xy *= rot2(sin(2.*i)+.2*tt);
        // p.xz -= .4*sin(tt);
        p.y += 1.-exp(-p.z*.1*i);
    }
    p.x = abs(p.x) + 2.5;
    return p;
}

float opSmoothIntersection( float d1, float d2, float k ) {
    float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) + k*h*(1.0-h);
}

float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

float map(vec3 p) {
    //p.xz *= rot2(PI*.5);
    vec3 bp = p;
    p.yz *= rot2(-PI*.25);
    p = kalei(p);
    float r = length(p);
    p = vec3(log(r),
    acos(p.z / r),
    atan(p.y, p.x));
    float shrink = 1./abs(p.y-PI) + 1./abs(p.y) - 1./PI;
    float scale = floor(MESH_DENSITY)/PI;
    // scale -= 15.*SIN(tt);
    p *= scale;
    p.x -= tt;
    p.y -= .7;
    vec3 id = repeat(p, vec3(LAYER_DISTANCE, .5, .5));
    p.yz *= rot2(.25*PI);
    p.x *= shrink;
    g_mat = bp.y*.6+id.x+abs(bp.x*.2);
    float w = LINE_WIDTH;
    float d = length(p.xz) - w;
    d = min(d, length(p.xy) - w);
    d *= r/(scale*shrink);
    // body
    bp.z *= .5;
    bp.z -= .75;
    vec3 bp1 = bp;
    bp1.x *= mix(1., 3., smoothstep(1.15, 1.3, bp1.y));
    
       r = mix(1.2, .8, smoothstep(-0.0, 1.1, 1.-abs(bp1.y)-.2));
    
    bd = sdPill(bp1, vec3(0, -.14, 0), vec3(0, .7, 0), r);
    // head
    bp1 = bp;
    bp1.x *= 1.;
    bd = opSmoothUnion(bd, length(bp1-vec3(0, 2.61, 0))-.6, 1.5);
    // legs
    bp1 = bp;
    bp1.z *= .6;
    bp1.z -= .6;
    bp1.x = -abs(bp1.x);
    vec3 p1 = vec3(0, -1.3, 0);
    vec3 p2 = vec3(-1.4, -0.8, -1.3);
    r = mix(.5, .31, dot(bp1, normalize(p2-p1)));
    bd = opSmoothUnion(bd, sdPill(bp1, p1, p2, r), .5);
    // arms
    bp1 = bp;
    bp1.z *= .5;
    bp1.z -= .1;
    bp1.x = -abs(bp1.x);
    p1 = vec3(-1.15, 1.2, -.1);
    p2 = vec3(-1.4, -0.85, -.2);
    r = .13;
    bd = opSmoothUnion(bd, sdPill(bp1, p1, p2, r), .4);
    // return bd*.5;
    d = opSmoothIntersection(d, bd-.4, .5);
    return d*.5;
}

vec2 moda(vec2 p, float repetitions) {
    float angle = 2.*PI/repetitions;
    float a = atan(p.y, p.x) + angle/2.;
    a = mod(a,angle) - angle/2.;
    return vec2(cos(a), sin(a))*length(p);
}

vec3 rings(vec2 uv) {
    float rings = 0.;
    vec2 uvr = uv;
    uvr *= 1.2;
    float triSize = 0.286;
    float hexSize = 0.5;
    float circleSize=.143;
    float lineWidth = 0.0015;
    float blur = 0.001;
    float glow = .3;
    float animr = 1.;
    vec3 ringc = vec3(0.761,0.851,1.000);
    #ifdef KALEI
    for(float i=0.; i< 3.; i++) {
        uvr = abs(uvr) - triSize;
        uvr *= rot2(cos(uvr.x+tt));
    }
    #endif
    rings += hexRing(uvr, hexSize, lineWidth, blur);
    rings += glow*hexRing(uvr, hexSize, lineWidth*5., blur); //glow
    vec2 uv0 = uvr;
    uv0 *= rot2(-PI*animr*curve(tt, 2.));
    rings += hexRing(uv0, hexSize*.5, lineWidth, blur);
    rings += glow*hexRing(uv0, hexSize*.5, lineWidth*5., blur);
    vec2 uv1 = uvr;
    uv1 *= rot2(PI*animr*(curve(tt, 2.)));
    rings += triRing(uv1, .286, lineWidth, blur);
    rings += glow*triRing(uv1, .286, lineWidth*5., blur); // glow
    vec2 uv2 = uvr;
    uv2 *= rot2(PI-animr*PI*((curve(tt, 2.))));
    rings += triRing(uv2, triSize, lineWidth, blur);
    rings += glow*triRing(uv2, triSize, lineWidth*5., blur); // glow
    vec2 uv3 = uvr;
    //uv3.y += .27;
    uv3 *= rot2(PI*.5);
    uv3 *= rot2(PI*animr*curve(tt, 2.));
    uv3 = moda(uv3, 6.);
    uv3.x -= mix(triSize, .576, abs(mod(curve(tt, 2.), 2.)-1.));
    rings += ring(uv3, circleSize, lineWidth, blur);
    rings += glow*ring(uv3, circleSize, lineWidth*5., blur);
    // rings += .3*ring(uv3, circleSize, lineWidth*8., blur);
    vec3 col = .6*mix(ringc, hue(-tt+length(uv)*2.+.5*PI), .5)*rings*mix(.0, .5, SIN(tt*PI));
    return col;
}

vec3 chakras(vec2 uv) {
    vec3 cols[7] = vec3[](vec3(0.608,0.020,1.000),
    vec3(0.169,0.059,1.000),
    vec3(0.000,0.800,1.000),
    vec3(0.035,1.000,0.020),
    vec3(0.984,1.000,0.161),
    vec3(1.000,0.463,0.020),
    vec3(1.000,0.000,0.000));
    float offs[7] = float[](.48, .355, .24, .12, 0., -.1, -.19);
    vec3 col = vec3(0);
    for(int i = 0; i < 7; i++) {
        vec2 coords = uv - vec2(0, offs[i]);
        float anim = .1+.9*SIN(-4.*tt+2.*PI*float(i)/7.);
        //anim = 1.;
        col += cols[i]*mix(1., .0,
        smoothstep(0., .28, pow(length(coords), .2)-.2))*anim;
    }
    return col;
}

int getCurrentCycle() {
    int cycle = 0;
    float str=0.0;
    float remainingTime = iTime;
    // Set 'str' once, before entering the loop
    if (strengthLevel == 0) {
        str = 5.0; // Initial strength for light level
    } else if (strengthLevel == 1) {
        str = 7.0; // Initial strength for regular level
    } else if (strengthLevel == 2) {
        str = 7.0; // Initial strength for strong level
    }
    while (remainingTime >= str) {
        cycle++;
        remainingTime -= str;
        // Update 'str' for subsequent cycles, only if necessary
        if (strengthLevel == 0) {
            str = (cycle > 16) ? 7.0 : str; // Update strength for light level after the initial cycle
        } else if (strengthLevel == 1) {
            str = (cycle > 31) ? 8.0 : str; // Update if cycle >= 31
        } else if (strengthLevel == 2) {
            str = (cycle > 31) ? 8.0 : (cycle > 61) ? 10.0 : str;
        }
    }
    return cycle;
}

vec2 size = vec2(0.55, -0.55);
vec2 edge = vec2(.5, 0.1);
vec2 xLine = vec2(0., 0.);
vec4 spacing = vec4(3., 2.25, 1.5, 3.5);

//font shapes

float circle(vec2 uv){
    return abs(length(uv)-size.x);
}

float circleS(vec2 uv){
    return abs(length(uv)-size.x*.5);
}

float vert(vec2 uv){
    return length(vec2(uv.x,max(0.,abs(uv.y)-size.x)));
}

float halfvert(vec2 uv){
    return length(vec2(uv.x,max(0.,abs(uv.y)-size.x*.5)));
}

float hori(vec2 uv){
    return length(vec2(max(0.,abs(uv.x)-size.x),uv.y));
}

float halfhori(vec2 uv){
    return length(vec2(max(0.,abs(uv.x)-size.x*.5),uv.y));
}

float diag(vec2 uv){
    return length(vec2(max(0.,abs((uv.y-uv.x))-size.x*2.),uv.y+uv.x));
}

float halfdiag(vec2 uv){
    return length(vec2(max(0.,abs(uv.x-uv.y)-size.x),uv.y+uv.x));
}

// Here is the alphabet

float aa(vec2 uv) {
    float x = circle(uv);
    x = mix(x, min(vert(uv-edge), vert(uv+edge)), step(uv.y, 0.));
    x = min(x, hori(uv-xLine));
    return x;
}

float bb(vec2 uv) {
    float x = vert(uv+edge);
    x = min(x, hori(uv-edge.yx));
    x = min(x, hori(uv+edge.yx));
    x = min(x, hori(uv-xLine));
    x = mix(min(circleS(uv-size.xx*.5),circleS(uv-size*.5)),x, step(uv.x, .5));
    return x;
}

float cc(vec2 uv) {
    float x = circle(uv);
    float p = .8;
    float a = atan(uv.x, abs(uv.y));
    a = smoothstep(.7, 1.5707, a);
    x += a;
    uv.y = -abs(uv.y);
    x = min(length(uv+size.x*vec2(-cos(p), sin(p))), x);
    return x;
}

float dd(vec2 uv) {
    float x = vert(uv+edge);
    x = min(x, hori(uv+edge.yx));
    x = min(x, hori(uv-edge.yx));
    x = mix(circle(uv),x, step(uv.x, 0.));
    return x;
}

float ee(vec2 uv) {
    float x = cc(uv);
    x = mix(circle(uv), x, step(uv.y, 0.));
    x = min(x, hori(uv));
    return x;
}

float ff(vec2 uv) {
    float x = vert(uv+edge);
    x = min(x, hori(uv-edge.yx));
    x = mix(circle(uv), x, step(min(-uv.x, uv.y), 0.));
    x = min(x, halfhori(uv+edge*.5));
    return x;
}

float gg(vec2 uv) {
    float x = cc(uv);
    x = mix(x, circle(uv), step(uv.y, 0.));
    x = min(x, halfhori(uv-edge*.5));
    return x;
}

float hh(vec2 uv) {
    float x = vert(abs(uv)-edge);
    x = min(x, hori(uv));
    //x = min(x, circle(uv+edge.yx));
    //x = mix(x, min(length(uv-size.xy), length(uv-size.yy)), step(uv.y, size.y));
    return x;
}

float ii(vec2 uv) {
    return hh(uv.yx);
}

float jj(vec2 uv) {
    float x = vert(uv-edge);
    x = min(x, length(uv+edge));
    x = mix(x, circle(uv), step(uv.y, 0.));
    return x;
}

float kk(vec2 uv) {
    uv.y = abs(uv.y);
    float x = circle(uv-edge.yx);
    x = mix( length(uv-size.xx),x,step(uv.y, size.x));
    x = mix(x,min(vert(uv+edge), hori(uv)), step(uv.x, 0.));
    return x;
}

float ll(vec2 uv) {
    return min(vert(uv+edge), hori(uv+edge.yx));
}

float mm(vec2 uv) {
    uv.x = abs(uv.x);
    float x = vert(uv-edge);
    x = min(x, halfvert(uv-edge.yx*.5));
    x = mix( circleS(uv-size.xx*.5),x, step(uv.y, 0.5));
    return x;
}

float nn(vec2 uv) {
    float x = circle(uv);
    x = mix(min(vert(uv-edge), vert(uv+edge)), x, clamp(ceil(uv.y), 0., 1.));
    return x;
}

float oo(vec2 uv) {
    return circle(uv);
}

float pp(vec2 uv) {
    float x = hori(uv);
    x = min(x, hori(uv-edge.yx));
    x = mix( circleS(uv+size.yy*.5),x, step(uv.x, size.x*.5));
    x = min(x, vert(uv+edge));
    return x;
}

float qq(vec2 uv) {
    float x = circle(uv);
    x = min(x, halfdiag(uv-size.xy*.5));
    return x;
}

float rr(vec2 uv) {
    float x = min(hori(uv-edge.yx), vert(uv+edge));
    x = mix(x, circle(uv), step(0., min(-uv.x, uv.y)));
    return x;
}

float ss(vec2 uv) {
    float x = hori(uv-edge.yx);
    x = min(x, halfhori(uv));
    vec2 u = uv;
    u+=vec2(-size.y*.5, size.y*.5);
    x = mix(circleS(u),x, step(-edge.x*.5, uv.x));
    float x2 = hori(uv+edge.yx);
    x2= min(x2, halfhori(uv));
    u = uv;
    u-=vec2(-size.y*.5, size.y*.5);
    x2 = mix(x2,circleS(u),step(edge.x*.5, uv.x));
    return min(x,x2);
}

float tt_(vec2 uv) {
    /*float x = min(hori(uv+edge.yx), vert(uv+edge));
    x = mix( circle(uv),x, step(0., max(uv.x, uv.y)));
    x = min(halfhori(uv+edge*.5), x);*/
    float x = min(vert(uv), hori(uv-edge.yx));
    return x;
}

float uu(vec2 uv) {
    uv.x = abs(uv.x);
    float x = mix(circle(uv), vert(uv-edge), step(0., uv.y));
    return x;
}

float vv(vec2 uv) {
    uv.x = abs(uv.x);
    float p = .5;
    uv *= mat2(cos(p), -sin(p), sin(p), cos(p));
    float x = vert(uv-edge*.5);
    return x;
}

float ww(vec2 uv) {
    uv.y = -uv.y;
    return mm(uv);
}

float xx(vec2 uv) {
    return diag(abs(uv)*vec2(-1., 1.));
}

float yy(vec2 uv) {
    uv.x = abs(uv.x);
    float x = min(halfvert(uv+edge.yx*.5), circle(uv-edge.yx));
    x = mix(x, length(uv-size.xx), step(size.x, uv.y));
    return x;
}

float zz(vec2 uv) {
    float x = min(hori(uv-edge.yx), hori(uv+edge.yx));
    uv.x = -uv.x;
    return min(x, diag(uv));
}

float bracketRight(vec2 uv){
    uv.x-=size.x*1.5;
    float p = 1.3;
    uv.y = abs(uv.y);
    float a = atan(uv.x, uv.y);
    float x = abs(length(uv)-size.x*2.);
    uv.y = -uv.y;
    x = mix(x, length(uv+vec2(cos(p), sin(p))*size.x*2.), step(-.3, a));
    return x;
}

float bracketLeft(vec2 uv){
    uv.x = -uv.x;
    return bracketRight(uv);
}

float semicolon(vec2 uv){
    float y = length(uv-edge.yx);
    uv+= vec2(size.x*.5, size.x*.75);
    float x = circleS(uv);
    float z = min(length(uv-edge.xy*.5),length(uv+edge.yx*.5));
    x = mix(z, x, step(max(uv.y, -uv.x),0.));
    x = min(x, y);
    return x;
}

vec3 dNormal(vec3 p){
    const vec2 e = vec2(0.01,0.0);
    return normalize(vec3(
    fField(p + e.xyy) - fField(p - e.xyy),
    fField(p + e.yxy) - fField(p - e.yxy),
    fField(p + e.yyx) - fField(p - e.yyx) ));
}

vec4 trace(vec3 ray_start, vec3 ray_dir){
    float ray_len = 0.0;
    vec3 p = ray_start;
    for(int i=0; i<iterations; ++i) {
        float dist = fField(p);
        //if (dist < dist_eps) break;
        if (ray_len > ray_max) return vec4(0.0);
        p += dist*ray_dir;
        ray_len += dist;
    }
    return vec4(p, 1.0);
}

vec3 shade(vec3 ray_start, vec3 ray_dir){
    vec4 hit = trace(ray_start, ray_dir);
    vec3 light_dir1 = normalize(vec3(1., 0.3, 1.));
    float ray_len;
    vec3 color;
    if (hit.w == 0.0) {
        ray_len = 1e16;
        color = vec3(.0);
    } else {
        vec3 dir = hit.xyz - ray_start;
        vec3 norm = dNormal(hit.xyz);
        float diffuse = max(0.0, dot(norm, light_dir1));
        diffuse = clamp(diffuse, 0.0, 1.);
        ray_len = distance(hit.xyz,ray_start);
        vec3 base_color = vec3(1.0,1.00,0.0);
        color.rgb = max((diffuse)*base_color, vec3(0.))+.1;
    }
    return color;
}

void pR(inout vec2 p, float a) {
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

float strength;
float cycle;
float progress;

void updateStrength(){
    cycle=float(getCurrentCycle());

    if (strengthLevel == 0) {
        strength = (cycle < 16.0) ? 5.0f : 7.0f;
    } else if (strengthLevel == 1) {
        strength = (cycle < 31.0) ? 7.0f : 8.0f;
    } else if (strengthLevel == 2) {
        if (cycle < 31.0) {
            strength = 7.0f;
        } else {
            strength = (cycle < 61.0) ? 8.0f : 10.0f;
        }
    }
}

float cycless;
float scycles;

float text( vec3 pos ){
    vec3 p = pos;
    // pR(p.xy, iTime);
    pos.x+=15.;
    pos.z-= 2.;
    // pR(pos.xy, sin(iTime)*.1);
    //TODO optimize
    spacing.y = spacing.x*.5;
    spacing.z = 1./spacing.x;
    float x = 100.;
    float nr = 0.;
    vec2 uv = pos.xz;
    float width = .2;
    cycless=float(getCurrentCycle());
    scycles=mod(cycless,4.0);
    if(strengthLevel==0&&cycless>31.){
        line5;scycles=4.;
    }
    if(strengthLevel==1&&cycless>61.){
        line5;scycles=4.;
    }
    if(strengthLevel==2&&cycless>91.){
        line5;scycles=4.;
    }
    if(scycles==0.){
        line2;
        line6;
    }
    if(scycles==1.){
        line4;
        line8;
    }
    if(scycles==2.){
        line3;
        line7;
    }
    if(scycles==3.){
        line4;
        line9;
    }
    // width+=sin(iTime*3.1415-length(pos.xz))*width*(iMouse.y/iResolution.y);
    x = length(vec2(x, pos.y));
    x-=width;
    return x;
}

float fField(vec3 p){
    return text(p);
}

const float STEP_LENGTH = 0.01;
const float ANGLE_OFFSET = PI*0.5;				// angle of dial
const vec4 color1 = vec4(1.0, 0.0, 0.0, 1.0);
const vec4 color2 = vec4(1.0, 1.0, 0.0, 1.0);

vec4 getGradientValue(in vec2 uv){
    vec2 dist =	vec2(1.0, 0.0) - vec2(-1.0, 0.0);
    float val = dot( uv - vec2(-1,0), dist ) / dot( dist, dist );
    clamp( val, 0.0, 1.0 );
    vec4 color = mix( color1, color2, val );
    if( color1.a >= color2.a )
    color.a = clamp( color.a, color2.a, color1.a );
    else
    color.a = clamp( color.a, color1.a, color2.a );
    return color;
}



void mainImage( out vec4 fragColor, in vec2 fragCoord ){


    updateStrength();

    cycless = cycle; // Update cycless to match the updated cycle
    scycles = mod(cycless, 4.0); // Update scycles based on cycless

    vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;
    float ang, si, co;
    ang =0.;
    float cam_dist = 20.;
    vec3 pos = vec3(0., cam_dist,0.);
    vec3 dir = normalize(vec3(uv.x,-1.,uv.y));
    vec3 Tcolor = shade(pos, dir);
    //uv *= rot2(PI*.5);
    vec3 rd = normalize(vec3(uv, .7)),
    lp = vec3(0.,2., -15);
    ro = vec3(0, 0.0, -4.);
    vec3 p = ro;
    vec3 col = vec3(0);
    float t, d = 0.1;
    tt = .3*iTime;
    float mat = 0.;
    vec2 e = vec2(0.0035, -0.0035);
    vec3 al = vec3(0);
    vec3 bg = vec3(0.016,0.086,0.125);
    for(float i=.0; i<80.; i++) {
        d = map(p);
        mat = g_mat;
        if(t > 7.) break;
        t += max(.01, abs(d));
        p += rd*d;
        // shading
        if(d < 0.006) {
            al = hue(mat*.4)*.9;
            // al = getPal(7, mat*.4);
            // al = vec3(1);
            col += al/exp(t*.6);
        }
        if(abs(bd-.04) < 0.0005 && bd < 0.04) {
            col += 1.1-exp(-bd*bd*50.);
        }
    }
    if(dot(col, col) < 0.001) {
        col += bg*mix(.3, 1.1, (1.-pow(dot(uv, uv), .5)));
        float stars = starPattern(uv);
        col += stars*0.6*(.1+.9*hue(-tt+length(uv))*(mix(.1, .2, SIN(length(uv)*1.5+tt))));
        col += .7*rings(uv);
    }
    float starss = starPattern(uv);
    col = .8*col+1.5*chakras(uv);
    col *= mix(.1, 1., (1.5-pow(dot(uv, uv), .2))); // vignette
    col = pow(col, vec3(.6)); // gamma
    // fragColor = mix(fragColor,vec4(col, 1.0 - t * 0.3),0.5);
    // vec3 fragColorTmp4=mix(col,Tcolor,0.9515);
    vec3 fragColorTmp4=Tcolor;
    // fragColorTmp4.r=max(fragColorTmp4.r,col.r);
    // fragColorTmp4.g=max(fragColorTmp4.g,col.g);
    // fragColorTmp4.b=max(fragColorTmp4.b,col.b);
    if(fragColorTmp4.r<0.05){
        fragColorTmp4.r=col.r;
    }else{fragColorTmp4.r-=.125*starss;}
    if(fragColorTmp4.g<0.05){
        fragColorTmp4.g=col.g;
    }
    if(fragColorTmp4.b<0.05){
        fragColorTmp4.b=col.b;
    }else{fragColorTmp4.b=1.0-(.725*starss);
    }
    progress = mod(iTime + (strength * 0.5), strength) / strength; // Shift progress by 0.5 * strength
    float innerRadius=0.5;
    float outerRadius=0.65;
    float startAngle = 0.0;
    float endAngle = progress* TAU;
    vec2 uv2 = (2.0*fragCoord.xy - iResolution.xy)/iResolution.y;
    float d2 = length( uv2 );
    vec4 ioColor = getGradientValue(uv2);
    float w = .15*( d2 ) * 1.0;
    
       float c = smoothstep( outerRadius + w, outerRadius - w, d2 );
       
       c -= smoothstep( innerRadius + w, innerRadius - w, d2 );
    
    vec4 fragColor2 = vec4(ioColor.rgb * vec3(c), 1.0);
    float angle = (atan(uv2.y,uv2.x)) + ANGLE_OFFSET;
    if( angle < 0.0 ) angle += PI * 2.0;
    if( angle > endAngle){
        float a = smoothstep( 0.75, -w*2.0, abs(endAngle - angle) );
        //float a = smoothstep( 0.0, -w*2.0, abs(endAngle - angle) );
        fragColor2 *= a;
    }
    if(angle - w*2.0 < startAngle ){
        float a=smoothstep(-w*2.0,w*2.0,(abs(startAngle-angle)));
        fragColor2 *= a;
    }
    vec4 fragColorTmp3=mix(vec4(fragColorTmp4,1.),fragColor2,0.415);
    fragColorTmp3.r=max(fragColorTmp3.r,fragColorTmp4.r);
    fragColorTmp3.g=max(fragColorTmp3.g,fragColorTmp4.g);
    fragColorTmp3.b=max(fragColorTmp3.b,fragColorTmp4.b);
    //fragColor = mix(fragColor,vec4(iTme_render),0.415);
    fragColor = fragColorTmp3;
    fragCoord/=25.;
    float numberPos=mix(0.,50.,(iResolution.x/2880.));
    int iTme_render=number(mod(iTime,strength),0,.10,vec2(4,1),fragCoord);
    float cycles=mod(cycle,4.0);
    int cycle_render=number(cycle,0,.10,vec2(1,1),fragCoord);
    int cycles_render=number(cycles,0,.10,vec2(3,1.),fragCoord);
    if (((fragCoord.x-=numberPos)<3.)&&((fragCoord.y)>0.3)&&((fragCoord.y)<3.5)) {
        // fragColor = mix(fragColor,vec4(D(fragCoord,floor(mod(iTime, 5.0)) + 1.0 )),0.15);
        vec4 fragColorTmp=mix(fragColor,vec4(iTme_render),0.415);
        fragColorTmp.r=max(fragColorTmp.r,fragColor.r);
        fragColorTmp.g=max(fragColorTmp.g,fragColor.g);
        fragColorTmp.b=max(fragColorTmp.b,fragColor.b);
        vec4 fragColorTmp2=mix(fragColor,vec4(cycle_render),0.415);
        fragColorTmp2.r=max(fragColorTmp2.r,fragColorTmp.r);
        fragColorTmp2.g=max(fragColorTmp2.g,fragColorTmp.g);
        fragColorTmp2.b=max(fragColorTmp2.b,fragColorTmp.b);
        fragColor =fragColorTmp2;
    }
}
