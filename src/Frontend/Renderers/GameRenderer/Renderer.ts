import autoBind from 'auto-bind';
import BackgroundRenderer from './Entities/BackgroundRenderer';
import Overlay2DRenderer from './Overlay2DRenderer';
import PlanetRenderer from './Entities/PlanetRenderer';
import VoyageRenderer from './Entities/VoyageRenderer';
import { UIRenderer } from './UIRenderer';
import LineRenderer from './Entities/LineRenderer';
import CircleRenderer from './Entities/CircleRenderer';
import TextRenderer from './Entities/TextRenderer';
import RectRenderer from './Entities/RectRenderer';
import PlanetRenderManager from './Entities/PlanetRenderManager';
import AsteroidRenderer from './Entities/AsteroidRenderer';
import BeltRenderer from './Entities/BeltRenderer';
import { MineRenderer } from './Entities/MineRenderer';
import { SpriteRenderer } from './Entities/SpriteRenderer';
import { GameGLManager } from './WebGL/GameGLManager';
import { WormholeRenderer } from './Entities/WormholeRenderer';
import GameUIManager from '../../../Backend/GameLogic/GameUIManager';
import { QuasarRenderer } from './Entities/QuasarRenderer';
import { SpacetimeRipRenderer } from './Entities/SpacetimeRipRenderer';
import { RuinsRenderer } from './Entities/RuinsRenderer';
import RingRenderer from './Entities/RingRenderer';
import BlackDomainRenderer from './Entities/BlackDomainRenderer';

class Renderer {
  static instance: Renderer | null;

  canvas: HTMLCanvasElement;
  glCanvas: HTMLCanvasElement;

  bufferCanvas: HTMLCanvasElement;

  frameRequestId: number;
  gameUIManager: GameUIManager;

  frameCount: number;
  now: number; // so that we only need to compute Date.now() once per frame

  // render engines
  glManager: GameGLManager;
  overlay2dRenderer: Overlay2DRenderer;

  // primitives
  lineRenderer: LineRenderer;
  circleRenderer: CircleRenderer;
  textRenderer: TextRenderer;
  rectRenderer: RectRenderer;

  // game entities
  bgRenderer: BackgroundRenderer;
  planetRenderer: PlanetRenderer;
  asteroidRenderer: AsteroidRenderer;
  beltRenderer: BeltRenderer;
  mineRenderer: MineRenderer;
  spriteRenderer: SpriteRenderer;
  quasarRenderer: QuasarRenderer;
  spacetimeRipRenderer: SpacetimeRipRenderer;
  ruinsRenderer: RuinsRenderer;
  ringRenderer: RingRenderer;
  blackDomainRenderer: BlackDomainRenderer;

  // render managers
  uiRenderManager: UIRenderer;
  planetRenderManager: PlanetRenderManager;
  voyageRenderManager: VoyageRenderer;
  wormholeRenderManager: WormholeRenderer;

  private constructor(
    canvas: HTMLCanvasElement,
    glCanvas: HTMLCanvasElement,
    bufferCanvas: HTMLCanvasElement,
    gameUIManager: GameUIManager
  ) {
    this.canvas = canvas;
    this.glCanvas = glCanvas;
    this.bufferCanvas = bufferCanvas;

    this.glManager = new GameGLManager(this, this.glCanvas);
    this.overlay2dRenderer = new Overlay2DRenderer(this, this.canvas);

    this.gameUIManager = gameUIManager;

    this.frameCount = 0;
    this.now = Date.now();

    autoBind(this);

    // do async stuff here e.g.: loadTextures(() => this.setup());
    this.setup();
  }

  private setup() {
    this.bgRenderer = new BackgroundRenderer(this.glManager);
    this.planetRenderer = new PlanetRenderer(this.glManager);
    this.asteroidRenderer = new AsteroidRenderer(this.glManager);
    this.beltRenderer = new BeltRenderer(this.glManager);
    this.mineRenderer = new MineRenderer(this.glManager);
    this.spriteRenderer = new SpriteRenderer(this.glManager, true, true);
    this.quasarRenderer = new QuasarRenderer(this.glManager);
    this.spacetimeRipRenderer = new SpacetimeRipRenderer(this.glManager);
    this.ruinsRenderer = new RuinsRenderer(this.glManager);
    this.ringRenderer = new RingRenderer(this.glManager);
    this.blackDomainRenderer = new BlackDomainRenderer(this.glManager);

    this.lineRenderer = new LineRenderer(this.glManager);
    this.circleRenderer = new CircleRenderer(this.glManager);
    this.rectRenderer = new RectRenderer(this.glManager);
    this.textRenderer = new TextRenderer(this.glManager, this.bufferCanvas);

    this.voyageRenderManager = new VoyageRenderer(this);
    this.wormholeRenderManager = new WormholeRenderer(this);
    this.planetRenderManager = new PlanetRenderManager(this);
    this.uiRenderManager = new UIRenderer(this);

    this.loop();
  }

  static destroy(): void {
    if (Renderer.instance) {
      window.cancelAnimationFrame(Renderer.instance.frameRequestId);
    }
    Renderer.instance = null;
  }

  static initialize(
    canvas: HTMLCanvasElement,
    glCanvas: HTMLCanvasElement,
    bufferCanvas: HTMLCanvasElement,
    gameUIManager: GameUIManager
  ) {
    const canvasRenderer = new Renderer(canvas, glCanvas, bufferCanvas, gameUIManager);
    Renderer.instance = canvasRenderer;

    return canvasRenderer;
  }

  private loop() {
    this.frameCount++;
    this.now = Date.now();
    this.draw();

    this.frameRequestId = window.requestAnimationFrame(() => this.loop());
  }

  /* one optimization we make is to queue batches of lots of vertices, then flush them all to the GPU in one go.
     one result of this is that things don't draw in the order they're queued - they draw in the order they're flushed.
     so *all lines* will draw before *all planets*. if you want to change the ordering on the layers, you need to add 
     an early flush() somewhere. */

  private draw() {
    // write matrix uniform
    this.glManager.setProjectionMatrix();

    // clear all
    this.overlay2dRenderer.clear();
    this.glManager.clear();

    // get some data
    const { locations, chunks } = this.gameUIManager.getLocationsAndChunks();

    // draw the bg
    this.bgRenderer.drawChunks(chunks);

    this.uiRenderManager.queueBorders();
    this.uiRenderManager.queueSelectedRangeRing();
    this.uiRenderManager.queueSelectedRect();
    this.uiRenderManager.queueHoveringRect();
    this.uiRenderManager.queueMousePath();
    this.uiRenderManager.drawMiner(); // drawn to canvas, which sits above gl

    // queue voyages calls
    this.voyageRenderManager.queueVoyages();

    // queue wormhole calls
    this.wormholeRenderManager.queueWormholes();

    // queue planets
    this.planetRenderManager.queuePlanets(locations, this.now);

    // flush all - ordering matters! (they get drawn bottom-up)
    this.lineRenderer.flush();
    this.planetRenderManager.flush();
    this.circleRenderer.flush();
    this.rectRenderer.flush();
    this.textRenderer.flush();
    this.spriteRenderer.flush();

    // render all of the plugins
    this.gameUIManager.getPluginManager()?.drawAllRunningPlugins(this.overlay2dRenderer.ctx);
  }

  // for throttled debugging: renderer.debug() && console.log(...);
  debug(interval = 120): boolean {
    return this.frameCount % interval === 0;
  }
}

export default Renderer;