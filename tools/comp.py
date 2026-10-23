import cv2, numpy as np, sys, os
from PIL import Image
A=os.environ.get('OVERLAY_DIR','analysis-overlay/')  # folder with the PNG overlays (red.png, wrinkles_all.png ...)
DET=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'assets','det_analysis.jpg')
OUT='./'
def load(p):
    a=np.array(Image.open(p).convert('RGBA'));return a
def gray(a):
    rgb=a[...,:3].astype(np.float32)*(a[...,3:4].astype(np.float32)/255) if a.shape[2]==4 else a.astype(np.float32)
    return cv2.cvtColor(rgb.astype(np.uint8),cv2.COLOR_RGB2GRAY)
def aff(A_,B_):
    sift=cv2.SIFT_create(6000); ka,da=sift.detectAndCompute(gray(A_),None); kb,db=sift.detectAndCompute(gray(B_),None)
    m=cv2.BFMatcher().knnMatch(da,db,k=2); good=[x for x,y in m if x.distance<0.75*y.distance]
    pa=np.float32([ka[g.queryIdx].pt for g in good]); pb=np.float32([kb[g.trainIdx].pt for g in good])
    M,inl=cv2.estimateAffinePartial2D(pa,pb,method=cv2.RANSAC,ransacReprojThreshold=2.5,maxIters=20000,confidence=0.999)
    return np.vstack([M,[0,0,1]]),int(inl.sum()),len(good)
det=np.array(Image.open(DET).convert('RGB'))
red=load(A+'red.png')
Mrd,_,_=aff(red,np.dstack([det,np.full(det.shape[:2],255,np.uint8)]))
def make(name,out):
    ov=load(A+name)
    if ov.shape[:2]==red.shape[:2] or abs(ov.shape[0]-971)<4:
        M,ni,ng=aff(ov,np.dstack([det,np.full(det.shape[:2],255,np.uint8)]))
    else:
        M1,ni,ng=aff(ov,red); M=Mrd@M1
    w=cv2.warpAffine(ov,M[:2],(det.shape[1],det.shape[0]),flags=cv2.INTER_LANCZOS4,borderValue=(0,0,0,0))
    al=w[...,3:4].astype(np.float32)/255
    comp=(w[...,:3]*al+det*(1-al)).astype(np.uint8)
    Image.fromarray(comp).save(out,quality=88)
    s=np.hypot(M[0,0],M[1,0]); print(name,'->',out.split('/')[-1],f'scale {s:.4f} tx {M[0,2]:.1f} ty {M[1,2]:.1f} inl {ni}/{ng}')
for n,o in [x.split(':') for x in sys.argv[1:]]: make(n,o)
