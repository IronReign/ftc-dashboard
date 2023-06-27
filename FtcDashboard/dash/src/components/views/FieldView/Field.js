import { cloneDeep } from 'lodash';
import fieldImageName from '@/assets/field.png';

// align coordinate to the nearest pixel, offset by a half pixel
// this helps with drawing thin lines; e.g., if a line of width 1px
// is drawn on an integer coordinate, it will be 2px wide
// x is assumed to be in *device* pixels
function alignCoord(x, scaling) {
  const roundX = Math.round(x * scaling);
  return (roundX + 0.5 * Math.sign(x - roundX)) / scaling;
}

function arrToDOMMatrix(arr) {
  return window.DOMMatrix.fromFloat64Array(Float64Array.from(arr));
}

CanvasRenderingContext2D.prototype.getScalingFactors = function () {
  let transform;
  if (typeof this.getTransform === 'function') {
    transform = this.getTransform();
  } else if (typeof this.mozCurrentTransform !== 'undefined') {
    transform = arrToDOMMatrix(this.mozCurrentTransform);
  } else {
    throw new Error('unable to find canvas transform');
  }

  const { a, b, c, d } = transform;
  const scalingX = Math.sqrt(a * a + c * c);
  const scalingY = Math.sqrt(b * b + d * d);

  return {
    scalingX,
    scalingY,
  };
};

CanvasRenderingContext2D.prototype.fineMoveTo = function (x, y) {
  const { scalingX, scalingY } = this.getScalingFactors();
  this.moveTo(alignCoord(x, scalingX), alignCoord(y, scalingY));
};

CanvasRenderingContext2D.prototype.fineLineTo = function (x, y) {
  const { scalingX, scalingY } = this.getScalingFactors();
  this.lineTo(alignCoord(x, scalingX), alignCoord(y, scalingY));
};

// this is a bit of a hack bit it'll have to do
// it's much better than sticking field renders in requestAnimationFrame()
const fieldImage = new Image();
const fieldsToRender = [];
let fieldLoaded = false;
fieldImage.onload = function () {
  fieldLoaded = true;
  fieldsToRender.forEach((field) => field.render());
};
fieldImage.src = fieldImageName;

const fieldAltImage = new Image();
let fieldAltLoaded = false;

fieldAltImage.onload = function(){
    fieldAltLoaded = true;
  }




fieldAltImage.src = '';
//fieldAltImage.src = 'https://upload.wikimedia.org/wikipedia/commons/4/45/Football_field.svg';

// all dimensions in this file are *CSS* pixels unless otherwise stated
const DEFAULT_OPTIONS = {
  padding: 15,
  alpha: 0.25,
  fieldSize: 12 * 12, // inches
  splineSamples: 250,
  gridLineWidth: 1, // device pixels
  gridLineColor: 'rgb(120, 120, 120)',
};

export default class Field {

  constructor(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.options = cloneDeep(DEFAULT_OPTIONS);
    Object.assign(this.options, options || {});

    this.overlay = {
      ops: [],
    };

    this.altIX = 0;
    this.altIY = 0;
    this.altIWidth = 0;
    this.altIHeight = 0;
    this.altOpaque = false;
    this.gridlinesVertical = 7;
    this.gridlinesHorizontal = 7;
  }

  setOverlay(overlay) {
    this.overlay = overlay;
  }

  render() {
    // eslint-disable-next-line
    this.canvas.width = this.canvas.width; // clears the canvas

    // scale the canvas to facilitate the use of CSS pixels
    this.ctx.scale(devicePixelRatio, devicePixelRatio);

    const width = this.canvas.width / devicePixelRatio;
    const height = this.canvas.height / devicePixelRatio;
    const smallerDim = width < height ? width : height;
    const fieldSize = smallerDim - 2 * this.options.padding;

    if (!fieldLoaded && fieldsToRender.indexOf(this) === -1) {
      fieldsToRender.push(this);
    }

    this.renderField(
      (width - fieldSize) / 2,
      (height - fieldSize) / 2,
      fieldSize,
      fieldSize,
    );
  }

  renderField(x, y, width, height) {
    this.ctx.save();
    this.ctx.globalAlpha = this.options.alpha;
    this.ctx.drawImage(fieldImage, x, y, width, height);
    if (fieldAltLoaded){
        //this.ctx.drawImage(fieldAltImage, x, y, width, height);
        if (this.altOpaque) this.ctx.globalAlpha = 1.0;
        this.ctx.drawImage(fieldAltImage, x + (this.altIX/144 * width), y + (this.altIY/144 * height), this.altIWidth/144 * width, this.altIHeight/144 * width);
        this.ctx.globalAlpha = this.options.alpha;
    }
    this.ctx.restore();

    this.renderGridLines(x, y, width, height, this.gridlinesHorizontal, this.gridlinesVertical);
    this.renderOverlay(x, y, width, height);
  }

  renderGridLines(x, y, width, height, numTicksX, numTicksY) {
    this.ctx.save();

    this.ctx.strokeStyle = this.options.gridLineColor;
    this.ctx.lineWidth = this.options.gridLineWidth / devicePixelRatio;

    const horSpacing = width / (numTicksX - 1);
    const vertSpacing = height / (numTicksY - 1);

    for (let i = 0; i < numTicksX; i++) {
      const lineX = x + horSpacing * i;
      this.ctx.beginPath();
      this.ctx.fineMoveTo(lineX, y);
      this.ctx.fineLineTo(lineX, y + height);
      this.ctx.stroke();
    }

    for (let i = 0; i < numTicksY; i++) {
      const lineY = y + vertSpacing * i;
      this.ctx.beginPath();
      this.ctx.fineMoveTo(x, lineY);
      this.ctx.fineLineTo(x + width, lineY);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

adjustOrigin(ctx, defaultTransform, altOriginX, altOriginY, altRotation){
    ctx.setTransform(defaultTransform);
    ctx.translate(altOriginX, altOriginY);
    ctx.rotate(altRotation);
}

drawAltFieldImage(ctx, src, x, y, width, height, altX, altY, altWidth, altHeight, altOpaque){
    fieldAltLoaded = false;
    this.altIX = altX;
    this.altIY = altY;
    this.altIWidth = altWidth;
    this.altIHeight = altHeight;
    this.altOpaque = altOpaque;
    fieldAltImage.src = src;
}

  renderOverlay(x, y, width, height) {
    const o = this.options;
    this.ctx.save();
    const originX = x + width / 2;
    const originY = y + height / 2;
    const rotation = Math.PI / 2;
    var altOriginX = 0;
    var altOriginY = 0;
    var altRotation = 0;

    this.ctx.translate(originX, originY);
    this.ctx.scale(width / o.fieldSize, -height / o.fieldSize);
    this.ctx.rotate(rotation);
    var defaultTransform = this.ctx.getTransform();

    this.ctx.lineCap = 'butt';

    this.overlay.ops.forEach((op) => {
      switch (op.type) {
        case 'image':
            this.drawAltFieldImage(this.ctx, op.src, x, y, width, height, op.x, op.y, op.width, op.height, op.opaque);
            break;
        case 'grid':
            this.gridlinesHorizontal = (op.numHorizontal>2) ? op.numHorizontal : 2;
            this.gridlinesVertical = (op.numVertical>2) ? op.numVertical : 2;
            break;
        case 'scale':
            //first reset the scale to the default
            this.adjustOrigin(this.ctx, defaultTransform, altOriginX, altOriginY, altRotation);
            this.ctx.scale(op.scaleX, op.scaleY);
            break;
        case 'rotation':
            altRotation = op.rotation;
            this.adjustOrigin(this.ctx, defaultTransform, altOriginX, altOriginY, altRotation);
            fieldAltImage
            break;
        case 'origin':
            altOriginX=op.x;
            altOriginY=op.y;
            this.adjustOrigin(this.ctx, defaultTransform, altOriginX, altOriginY, altRotation);
            break;
        case 'alpha':
            this.ctx.globalAlpha = op.alpha;
            break;
        case 'fill':
          this.ctx.fillStyle = op.color;
          break;
        case 'stroke':
          this.ctx.strokeStyle = op.color;
          break;
        case 'strokeWidth':
          this.ctx.lineWidth = op.width;
          break;
        case 'text':
            this.ctx.save();
            this.ctx.rotate(op.theta);
            this.ctx.font = op.font;
            //have to flip y axis again temporarily or text will be mirrored
            this.ctx.scale(1, -1);
            if (op.stroke) {
                this.ctx.strokeText(op.text, op.x, op.y)
            } else {
                this.ctx.fillText(op.text, op.x, op.y)
            }
            this.ctx.restore();
            break;
        case 'circle':
          this.ctx.beginPath();
          this.ctx.arc(op.x, op.y, op.radius, 0, 2 * Math.PI);

          if (op.stroke) {
            this.ctx.stroke();
          } else {
            this.ctx.fill();
          }
          break;
        case 'polygon': {
          this.ctx.beginPath();
          const { xPoints, yPoints, stroke } = op;
          this.ctx.fineMoveTo(xPoints[0], yPoints[0]);
          for (let i = 1; i < xPoints.length; i++) {
            this.ctx.fineLineTo(xPoints[i], yPoints[i]);
          }
          this.ctx.closePath();

          if (stroke) {
            this.ctx.stroke();
          } else {
            this.ctx.fill();
          }
          break;
        }
        case 'polyline': {
          this.ctx.beginPath();
          const { xPoints, yPoints } = op;
          this.ctx.fineMoveTo(xPoints[0], yPoints[0]);
          for (let i = 1; i < xPoints.length; i++) {
            this.ctx.fineLineTo(xPoints[i], yPoints[i]);
          }
          this.ctx.stroke();
          break;
        }
        case 'spline': {
          this.ctx.beginPath();
          const { ax, bx, cx, dx, ex, fx, ay, by, cy, dy, ey, fy } = op;
          this.ctx.fineMoveTo(fx, fy);
          for (let i = 0; i <= o.splineSamples; i++) {
            const t = i / o.splineSamples;
            const sx =
              (ax * t + bx) * (t * t * t * t) +
              cx * (t * t * t) +
              dx * (t * t) +
              ex * t +
              fx;
            const sy =
              (ay * t + by) * (t * t * t * t) +
              cy * (t * t * t) +
              dy * (t * t) +
              ey * t +
              fy;

            this.ctx.lineTo(sx, sy);
          }
          this.ctx.stroke();
          break;
        }
        default:
          throw new Error(`unknown operation: ${op.type}`);
      }
    });

    this.ctx.restore();
  }
}
