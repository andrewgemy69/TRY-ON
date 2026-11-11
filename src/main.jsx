import SizingGuide from './SizingGuide.jsx';
import { createGlassesRenderer } from './glasses-renderer.js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Activity, ArrowDown, ArrowRight, Camera, Check, ChevronDown, CircleHelp, Glasses, Info, Ruler, ShieldCheck, Sparkles, X } from 'lucide-react';
import './styles.css';

const catalog = {
  glasses: [
    { id: 'atelier', name: 'Atelier 01', type: 'OPTICAL · ACETATE', price: '$168', color: '#292722', shape: 'round' },
    { id: 'sol', name: 'Sol Frame', type: 'SUN · TORTOISE', price: '$192', color: '#a56b3c', shape: 'round' },
    { id: 'linea', name: 'Linea 03', type: 'OPTICAL · METAL', price: '$154', color: '#bca477', shape: 'line' },
  ],

};

function GlassesOverlay({ item, width, height }) {
  const frame = item?.color || '#292722';
  return <svg className="garment-overlay" viewBox="0 0 640 760" preserveAspectRatio="none" aria-hidden="true">
    <g fill="none" stroke={frame} strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" opacity=".96">
      <path d="M 205 302 Q 211 288 230 288 L 286 288 Q 305 290 308 310 L 303 350 Q 299 375 272 375 L 232 372 Q 207 368 205 343 Z" />
      <path d="M 333 310 Q 336 290 355 288 L 410 288 Q 429 288 435 302 L 435 343 Q 433 368 408 372 L 368 375 Q 341 375 337 350 Z" />
      <path d="M 307 311 Q 320 304 334 311 M 204 305 L 176 296 M 436 305 L 464 296" />
    </g>
    <path d="M207 311 Q256 303 302 313" fill="none" stroke={item?.color || '#292722'} strokeWidth="3" opacity=".4" />
  </svg>;
}


function App() {
  const videoRef = useRef(null);
  const sizingRef=useRef(null);
  const [sizeLabel,setSizeLabel]=useState('');
  const glCanvasRef = useRef(null);
  const glRef = useRef(null);
  const glProgramRef = useRef(null);
  const glModelRef = useRef(null);
  const glBufferRef = useRef(null);
  const faceMeshRef = useRef(null);
  const rigidFaceRef=useRef(null);
  const glPoseRef = useRef({x:.5,y:.4,width:.3,roll:0,yaw:0});
  const faceRef = useRef(null);
  const rafRef = useRef(0);
  const [selected, setSelected] = useState(catalog.glasses[0]);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState('Camera is off');
  const [landmarks, setLandmarks] = useState(null);
  const [error, setError] = useState('');
  const [renderError,setRenderError]=useState('');
  const [modelReady,setModelReady]=useState(false);
  const [renderFrames,setRenderFrames]=useState(0);
  const [fitGuides,setFitGuides]=useState([]);
  const occlusionEnabledRef=useRef(true);
  const [mirror, setMirror] = useState(true);
  const [fitOpen, setFitOpen] = useState(false);
  const [sizingOpen,setSizingOpen]=useState(false);
  const [heightCm, setHeightCm] = useState('');
  const [shoulderCm, setShoulderCm] = useState('');
  const [size, setSize] = useState('M');
  const [view, setView] = useState('front');
  const [manualFit, setManualFit] = useState(false);
  const [manualPose, setManualPose] = useState({x:.5,y:.34,width:.14,roll:0,yaw:0});

  const activeList = catalog.glasses;
  const isGlasses = true;

  useEffect(() => {
    setModelReady(false); setRenderError('');
    try { return createGlassesRenderer(glCanvasRef.current,videoRef,rigidFaceRef,faceMeshRef,setModelReady,setRenderError,sizingRef); }
    catch(e) { setRenderError('3D initialization: '+e.message); }
  }, []);

  const stopCamera = useCallback(() => {
    rigidFaceRef.current=null; faceMeshRef.current=null;
    cancelAnimationFrame(rafRef.current);
    videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    faceRef.current?.close(); faceRef.current = null;
    setCameraOn(false); setLandmarks(null); setStatus('Camera is off');
  }, []);

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); faceRef.current?.close(); }, []);

  const startCamera = async () => {
    setError(''); setStatus('Requesting camera access…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires HTTPS or localhost in a supported browser.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      const video = videoRef.current; video.srcObject = stream; await video.play();
      setCameraOn(true); setStatus('Loading on-device tracking…');
      const appBase=import.meta.env.BASE_URL;
      const vision = await FilesetResolver.forVisionTasks(`${appBase}mediapipe/wasm`);
      const modelPath=`${appBase}models/face_landmarker.task`;
      const modelCheck=await fetch(modelPath,{method:'HEAD'});
      if(!modelCheck.ok)throw new Error(`Missing ${modelPath}. Download the MediaPipe model and save it at this exact path.`);
      const baseOptions={modelAssetPath:modelPath,delegate:'CPU'};
      faceRef.current = await FaceLandmarker.createFromOptions(vision, { baseOptions, runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: true });

      setManualFit(false);setError(''); setStatus('Face tracking active');
      let lastVideoTime = -1;
      const loop = () => {
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          try {
            const result = faceRef.current?.detectForVideo(video, performance.now());
            const pts = result?.faceLandmarks?.[0];
            rigidFaceRef.current=result.facialTransformationMatrixes?.[0]?.data;
            faceMeshRef.current=pts;
            if (pts) setLandmarks(pts); else setLandmarks(null);
          } catch (frameError) { setError(`Tracking frame failed: ${frameError.message || frameError}`); }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      // Keep an acquired camera stream visible if the tracker/model could not initialize.
      if (videoRef.current?.srcObject) {
        setCameraOn(true); setStatus('Camera on · tracker unavailable');
        setManualFit(true);glPoseRef.current={...manualPose};
        setError(`Tracking is off, so the glasses are in manual mode. ${e?.message || 'MediaPipe failed to initialize.'}`);
      } else { stopCamera(); setStatus('Camera unavailable'); setError(e?.message || 'Could not start camera. Check your browser permissions.'); }
    }
  };

  const faceWidth = landmarks && landmarks[454] && landmarks[234] ? Math.round(Math.abs(landmarks[454].x - landmarks[234].x) * 100) : null;
  const inferredSize = shoulderCm ? (Number(shoulderCm) < 40 ? 'S' : Number(shoulderCm) < 46 ? 'M' : Number(shoulderCm) < 52 ? 'L' : 'XL') : size;

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">f.</span><span>FORMA<span className="brand-sub">VIRTUAL STUDIO</span></span></a><nav className="nav-links"><a className="active" href="#studio">THE STUDIO</a><a href="#collection">COLLECTION</a><a href="#fit">FIT GUIDE</a></nav><div className="top-actions"><button className="text-btn" onClick={() => setFitOpen(true)}>Find my fit <ArrowRight size={14}/></button><span className="top-divider"/><button className="menu-btn" aria-label="Open menu"><span/><span/></button></div></header>
    <main id="top">
<button className="size-launch" onClick={()=>setSizingOpen(true)}>Measure face & compare stock sizes</button>{sizeLabel&&<button onClick={()=>{sizingRef.current=null;setSizeLabel('')}}>Calibrated size: {sizeLabel} · Return to auto-fit</button>}
{sizingOpen&&<SizingGuide video={videoRef} landmarks={faceMeshRef} onSelect={size=>{sizingRef.current=size;setSizeLabel(size.name)}} onClose={()=>setSizingOpen(false)}/>}
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/>THE NEW WAY TO TRY</div><h1>A better fit<br/>starts <em>with you.</em></h1><p className="hero-description">Discover how the right frame or layer feels before it ever reaches your door. A more personal way to find your next forever piece.</p><a href="#studio" className="hero-cta">ENTER THE STUDIO <ArrowDown size={15}/></a><div className="hero-index"><span>01</span><span className="index-line"/><span>VIRTUAL FIT, PERSONAL FEEL</span></div></div><div className="hero-image"><div className="hero-photo"><div className="hero-photo-tag">FORM IN FOCUS <span>NO. 01 / 03</span></div><div className="hero-orbit"/><div className="hero-model"><div className="model-hair"/><div className="model-face"><div className="model-eye eye-one"/><div className="model-eye eye-two"/><div className="model-nose"/><div className="model-mouth"/></div><div className="model-neck"/><div className="model-shirt"><div className="shirt-lapel left"/><div className="shirt-lapel right"/></div><div className="model-ear"/></div><div className="hero-caption">A study in shape, proportion<br/>and personal style.</div></div><div className="hero-side-note">NEW YORK&nbsp; · &nbsp;COPENHAGEN&nbsp; · &nbsp;EVERYWHERE</div><div className="hero-counter">01 <span>/</span> 03</div></div></section>

      <section className="studio-section" id="studio"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>YOUR PERSONAL FITTING ROOM</div><h2>See it <em>on you.</em></h2></div><p>Small details make all the difference.<br/>Let’s find the ones that feel like yours.</p></div>
        <div className="studio-grid"><aside className="product-panel"><div className="panel-label">01 — SELECT A CATEGORY</div><div className="category-switch"><button className="selected"><Glasses size={16}/> EYEWEAR</button></div><div className="panel-label item-label">02 — CHOOSE YOUR PIECE</div><div className="products">{activeList.map(item=><button key={item.id} className={`product-card ${selected.id===item.id?'chosen':''}`} onClick={()=>setSelected(item)}><span className="product-swatch" style={{'--swatch':item.color}}><Glasses size={22}/></span><span className="product-meta"><b>{item.name}</b><small>{item.type}</small></span><span className="product-price">{item.price}</span></button>)}</div><div className="fit-card"><div className="fit-card-top"><span className="fit-icon"><Ruler size={16}/></span><span><b>A little more personal</b><small>Find your recommended size</small></span></div><button onClick={()=>setFitOpen(true)}>OPEN FIT FINDER <ArrowRight size={14}/></button></div><div className="privacy-note"><ShieldCheck size={14}/><span>Your camera stays yours. Processing happens in your browser.</span></div></aside>

          <div className="tryon-panel"><div className="mobile-diagnostics" role="status"><strong>Three.js renderer · revision 5</strong><span>{status}</span><span>Glasses model: {modelReady?'loaded':'loading'} · Face: {landmarks?'detected':'not detected'}</span>{(renderError||error)&&<span>{renderError||error}</span>}</div><div className="tryon-toolbar"><div className="live-state"><span className={`status-dot ${cameraOn?'on':''}`}/><span>{status.toUpperCase()}{renderError ? ' · 3D ERROR' : modelReady ? ' · 3D READY' : ' · LOADING GLASSES'}</span></div><div className="toolbar-right"><button className="icon-button" title="Mirror preview" onClick={()=>setMirror(v=>!v)}><Activity size={15}/></button><span className="toolbar-divider"/><button className="view-select" onClick={()=>setView(view==='front'?'side':'front')}>{view.toUpperCase()} VIEW <ChevronDown size={13}/></button></div></div><div className="camera-stage">{landmarks&&fitGuides.map((p,i)=><span key={i} className={`fit-guide ${p.kind}`} style={{left:p.x,top:p.y}}/>)}<video ref={videoRef} className={`camera-feed ${mirror?'mirrored':''} ${cameraOn?'visible':''}`} playsInline muted/><canvas ref={glCanvasRef} className={`glb-canvas ${landmarks?'visible':''}`}/><div className="stage-ambient"/><div className={`stage-placeholder ${cameraOn?'hidden':''}`}><div className="placeholder-rings"><span/><span/><div className="placeholder-silhouette"><div className="silhouette-head"/><div className="silhouette-neck"/><div className="silhouette-body"/></div><div className="face-guide"><span/><span/><span/></div></div><p>YOUR SPACE, YOUR PACE</p><small>Turn your camera on to begin</small></div>{cameraOn&&landmarks&&<div className="tracking-hud"><span className="hud-pill"><span className="status-dot on"/> FACE DETECTED</span><span className="hud-corner top-left"/><span className="hud-corner top-right"/><span className="hud-corner bottom-left"/><span className="hud-corner bottom-right"/></div>}{!cameraOn&&<div className="demo-overlay" onClick={()=>{}}></div>}<div className="stage-ambient"/><div className="stage-bottom-left"><span>LIVE PREVIEW</span><span className="bottom-dot"/><span>ON-DEVICE TRACKING</span></div><div className="stage-coordinates">{landmarks?`FACE WIDTH · ${faceWidth}% FRAME`:'FIT IS PERSONAL'}</div></div>{manualFit&&<div className="manual-fit"><span>MANUAL ALIGNMENT · TRACKING MODEL NEEDED TO FOLLOW YOUR FACE</span>{[['x','LEFT ↔ RIGHT'],['y','UP ↕ DOWN'],['width','SIZE']].map(([key,label])=><label key={key}>{label}<input type="range" min={key==='width'?.08:0} max={key==='width'?.45:1} step=".01" value={manualPose[key]} onChange={e=>{const next={...manualPose,[key]:Number(e.target.value)};setManualPose(next);glPoseRef.current=next}}/></label>)}</div>}<div className="stage-controls">{(renderError||error)&&<div className="tracking-error" role="status">{renderError||error}</div>}<button className={`primary-button ${cameraOn?'is-on':''}`} onClick={cameraOn?stopCamera:startCamera}>{cameraOn?<><X size={16}/> END SESSION</>:<><Camera size={16}/> START TRY-ON</>}</button><button className="tip-button" onClick={()=>setFitOpen(true)}><CircleHelp size={16}/></button></div></div>
        </div><div className="studio-footnote"><span>01 / 02</span><span className="footnote-line"/><span>REAL-TIME PREVIEW · FIT GUIDANCE · ALL YOU</span><a href="#fit">HOW IT WORKS <ArrowRight size={13}/></a></div>
      </section>

      <section className="fit-section" id="fit"><div className="fit-intro"><div className="eyebrow"><span className="eyebrow-line"/>A NOTE ON FIT</div><h2>Feel good<br/><em>in your size.</em></h2><p>Our camera preview helps with visual proportions. For a useful frame size estimate, compare its width against a known measurement.</p><button className="outline-button" onClick={()=>setFitOpen(true)}>EXPLORE FIT GUIDANCE <ArrowRight size={14}/></button></div><div className="fit-facts"><div className="fit-fact"><span>01</span><div><b>See the proportions</b><p>Face landmarks align the selected glasses with your camera preview.</p></div><Sparkles size={17}/></div><div className="fit-fact"><span>02</span><div><b>Add a real measurement</b><p>Compare the frame width with a known measurement for a more useful size suggestion.</p></div><Ruler size={17}/></div><div className="fit-fact"><span>03</span><div><b>Choose with confidence</b><p>Real fit still depends on each brand’s frame measurements and intended shape.</p></div><Check size={17}/></div><div className="fit-disclaimer"><Info size={14}/><span>A camera image alone cannot guarantee real world fit. Use frame measurements as a sizing guide.</span></div></div></section>
      <footer><a className="brand footer-brand" href="#top"><span className="brand-mark">f.</span><span>FORMA<span className="brand-sub">VIRTUAL STUDIO</span></span></a><span>MADE FOR THE WAY YOU SEE YOURSELF.</span><span>© 2026 FORMA STUDIO</span></footer>
    </main>
    {fitOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setFitOpen(false)}}><div className="fit-modal"><button className="modal-close" onClick={()=>setFitOpen(false)} aria-label="Close"><X size={18}/></button><div className="eyebrow"><span className="eyebrow-line"/>A BETTER STARTING POINT</div><h2>Your fit, <em>your way.</em></h2><p className="modal-copy">Enter measurements you already know. The camera can show proportions, but it can’t establish real-world scale without a reference.</p><label className="measurement-label">YOUR HEIGHT <span>OPTIONAL</span><div className="measurement-field"><input type="number" min="100" max="230" placeholder="e.g. 172" value={heightCm} onChange={e=>setHeightCm(e.target.value)}/><span>CM</span></div></label><label className="measurement-label">SHOULDER WIDTH <span>OPTIONAL</span><div className="measurement-field"><input type="number" min="25" max="70" placeholder="Measure across the back" value={shoulderCm} onChange={e=>setShoulderCm(e.target.value)}/><span>CM</span></div></label><div className="size-row"><div><b>STARTING SIZE</b><small>Based on your shoulder measurement</small></div><strong>{inferredSize}</strong></div><div className="size-options">{['XS','S','M','L','XL'].map(s=><button className={inferredSize===s?'picked':''} key={s} onClick={()=>setSize(s)}>{s}</button>)}</div><div className="modal-note"><Info size={14}/><span>Suggestions are a starting point. Check the brand’s size chart and garment measurements before purchasing.</span></div><button className="primary-button modal-done" onClick={()=>setFitOpen(false)}>SAVE MY STARTING SIZE <Check size={15}/></button></div></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
