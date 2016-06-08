var treemapChart = {};
(function(window) {

  const Log = function(msg) {
  }

  class Utils {
      static parseRgbString(rgbString) {
        let rgb = rgbString.replace(/[^\d,]/g, '').split(',');
        return { R: parseInt(rgb[0]), G: parseInt(rgb[1]), B: parseInt(rgb[2]) };
      }

      static trim(x) {
        return x.replace(/^\s+|\s+$/gm,'');
      }
  }

  class Parameters {
    constructor() {
      this.DEFAULT_SORT_PROPERTY = this._sortProperty = null;
      this.DEFAULT_SORT_ORDER = this._sortOrder = "dsc";
      this.DEFAULT_COLOR_BOUNDS = this._colorBounds = [
        { R: 255, G: 0, B: 0 },
        { R: 127, G: 127, B: 127 },
        { R: 0, G: 255, B: 0 }
      ]
    }

    set sortProperty(value = DEFAULT_SORT_PROPERTY) {
      let isSortValueValid = value == "sizeValue" || value == "colorValue";
      if (!isSortValueValid) {
        return;
      }
      this._sortProperty = value;
    }

    get sortProperty() {
      return this._sortProperty;
    }

    set sortOrder(value = DEFAULT_SORT_ORDER) {
        if (value == "asc" || value == "dsc") {
          this._sortOrder = value;
        }
      }

    get sortOrder() {
      return this._sortOrder;
    }

    _isColorValid(color) {
      if (!color) {
        return false;
      }
      let colors = ['R', 'G', 'B'];
      for (let i = 0; i < colors.length; i++) {
        if (color[color[i]] < 0 || color[color[i]] > 255) {
          console.log("One of the input colors doesn't fit in range 0-255");
          return false;
        }
      }
      return true;
    }

    set colorBounds(value = DEFAULT_COLOR_BOUNDS) {
      if (value.length == 0) {
        console.log("Input color bounds parameter array is invalid");
        this._colorBounds = DEFAULT_COLOR_BOUNDS;
      }
      for (let i = 0; i < value.length; i++) {
        let color = Utils.parseRgbString(value[i]);
        if (!this._isColorValid(color)) {
          return;
        }
        this._colorBounds[i] = color;
      }
    }

    get colorBounds() {
      return this._colorBounds;
    }
  }

  class Element {
    constructor(sizeValue, colorValue) {
      this.sizeValue = sizeValue;
      this.colorValue = colorValue;
    }

    static clone(element) {
      return JSON.parse(JSON.stringify(element));
    }
  }

  class Rectangle {

    constructor(left, top, width, height) {
      this.left = left;
      this.top = top;
      this.width = width;
      this.height = height;
    }

    get colorValue() {
      return this.element.colorValue;
    }

    get color() {
      return this.element.color;
    }

    set color(value) {
      this.element.color = value;
    }

    get content() {
      return this.element.content;
    }

  }


  class MathUtils {

    static normalizeColors(elements) {
      let min = Number.MAX_VALUE, max = Number.MIN_VALUE;
      elements.forEach((currentElement) => {
        min = Math.min(currentElement.colorValue, min);
        max = Math.max(currentElement.colorValue, max);
      });
      let normalizedElements = elements.map((currentElement) => {
        let normalizedElement = Element.clone(currentElement);
        if (currentElement.colorValue < 0) {
          normalizedElement.colorValue = ((currentElement.colorValue - min) / -min) - 1;
        } else {
          normalizedElement.colorValue = ((currentElement.colorValue) / max);
        }
        return normalizedElement;
      });
      return normalizedElements;
    }

    /*
     *  Greedy algorithm for partitioning elements by weight.
     */
    static findPartition(elements) {
      let aSum = 0;
      let bSum = 0;
      let a = [];
      let b = [];
      let li = 0, ri = elements.length - 1;
      while (li <= ri) {
        if (aSum + elements[li].sizeValue < bSum + elements[ri].sizeValue) {
          a.push(elements[li]);
          aSum += elements[li].sizeValue;
          li++;
        } else {
          b.unshift(elements[ri]);
          bSum += elements[ri].sizeValue;
          ri--;
        }
      }
      let result = {
        a: a,
        b: b,
        aPercentage: aSum / (aSum + bSum),
        bPercentage: bSum / (aSum + bSum)
      };
      return result;
    }

    static color(pct, lowerBound, upperBound) {
      let actualColor = {R:0, G:0, B:0};
      ['R', 'G', 'B'].forEach(prop => {
        actualColor[prop] = lowerBound[prop] + pct * (upperBound[prop] - lowerBound[prop]);
      });
      return actualColor;
    }
  }

  class HTMLRenderer {
    constructor(params) {
      this._params = params;
    }

    get params() {
      if (!this._params) {
        return {};
      }
      return this._params;
    }

    static rbgString(value) {
      return "rgb(" + value.R.toFixed(0) + "," + value.G.toFixed(0) + "," + value.B.toFixed(0) + ")";
    }

    static appendClasses(classes, element) {
      let concat = "";
      classes.forEach((cssClass) => {
        concat += cssClass + " ";
      });
      element.setAttribute("class", Utils.trim(concat));
    }

    render(heatmapModel, domElement) {
      let rectangles = [];
      heatmapModel.forEach((rectangle) => {
        let rectangleDiv = document.createElement("div");
        rectangleDiv.style.position = "absolute";
        rectangleDiv.style.left = rectangle.left + "%";
        rectangleDiv.style.top = rectangle.top + "%";
        rectangleDiv.style.width = rectangle.width + "%";
        rectangleDiv.style.height = rectangle.height + "%";
        rectangleDiv.style.backgroundColor = HTMLRenderer.rbgString(rectangle.color);
        if (this.params.rectangleClasses) {
          HTMLRenderer.appendClasses(this.params.rectangleClasses, rectangleDiv);
        }
        if (rectangle.content) {
          let textSpan = document.createElement("span");
          if (this.params.innerContentClasses) {
            HTMLRenderer.appendClasses(this.params.innerContentClasses, textSpan);
          }
          textSpan.innerHTML = rectangle.content.html;
          rectangleDiv.appendChild(textSpan);
        }
        domElement.appendChild(rectangleDiv);
        rectangles.push(rectangleDiv);
      });
      if (this.params.onrendered) {
        this.params.onrendered(rectangles);
      }
    }
  }
  treemapChart[HTMLRenderer] = HTMLRenderer;

  class CanvasRenderer {
    constructor(params) {
      this._params = params;
    }

    get params() {
      if (!this._params) {
        return {};
      }
      return this._params;
    }

    static pct2Px(pctValue, totalDistance) {
      return (pctValue / 100) * totalDistance;
    }

    static rbgString(value) {
      return "rgb(" + value.R.toFixed(0) + "," + value.G.toFixed(0) + "," + value.B.toFixed(0) + ")";
    }

    render(heatmapModel, canvas) {
      let canvasContext = canvas.getContext("2d");
      let canvasWidth = canvas.width;
      let canvasHeight = canvas.height;
      heatmapModel.forEach((rectangle) => {
        let left = CanvasRenderer.pct2Px(rectangle.left, canvasWidth);
        let top = CanvasRenderer.pct2Px(rectangle.top, canvasHeight);
        let width = CanvasRenderer.pct2Px(rectangle.width, canvasWidth);
        let height = CanvasRenderer.pct2Px(rectangle.height, canvasHeight);

        canvasContext.fillStyle = "black";
        if (rectangle.color) {
          canvasContext.fillStyle = CanvasRenderer.rbgString(rectangle.color);
        }
        canvasContext.fillRect(left, top, width, height);
        if (this.params.rectanglePostRender) {
          this.params.rectanglePostRender(canvasContext, {x: left, y: top, width: width, height: height}, rectangle.content);
        }
      });
    }
  }
  treemapChart[CanvasRenderer] = CanvasRenderer;

  class Heatmap {

    constructor(params, elements) {
      let actualParameters = new Parameters();
      if (typeof params == 'undefined' || !params) {
          this.params = actualParameters;
      }
      actualParameters.sortProperty = params.sortProperty;
      actualParameters.sortOrder = params.sortOrder;
      actualParameters.colorBounds = params.colorBounds;
      this.params = actualParameters;

      this._validateElements(elements);
      this.elements = elements;
    }

    _validateElements(elements) {
      if (typeof elements == 'undefined' || elements == null) {
        throw 'Input elements are not defined';
      }
      if (elements.length == 0) {
        throw 'Nothing to calculate - input array is empty.';
      }
    }

    heatmapModel() {
      if (!this.rectangles) {
        this._build();
      }
      return this.rectangles;
    }

    /*
     * Builds rendering model for the treemap
     */
    _build() {
      let rectangle = new Rectangle(0, 0, 100, 100);
      let elements = MathUtils.normalizeColors(this.elements);
      if (this.params.sortProperty) {
        elements.sort((a, b) => {
          return "dsc" == this.params.sortOrder ? b[this.params.sortProperty] - a[this.params.sortProperty]
            : a[this.params.sortProperty] - b[this.params.sortProperty];
        });
      }

      let rectangles = [];
      this._split(elements, rectangle, rectangles);
      if (this.params.colorBounds) {
        this._buildColors(rectangles);
      }
      this.rectangles = rectangles;
    }

    _buildColors(rectangles) {
      rectangles.forEach((rectangle) => {
        let lowerColorIndex = 0, upperColorIndex = 1;
        if (this.params.colorBounds.length == 3) {
          if (rectangle.colorValue >= 0) {
            lowerColorIndex = 1;
            upperColorIndex = 2;
          }
        }
        let colorValue = rectangle.colorValue < 0 ? rectangle.colorValue + 1 : rectangle.colorValue;
        rectangle.color = MathUtils.color(colorValue, this.params.colorBounds[lowerColorIndex], this.params.colorBounds[upperColorIndex])
      });
    }

    _split(elements, rectangle, rectangles) {
      if (elements.length == 0) {
        return;
      }
      if (elements.length == 1) {
        rectangle.element = elements[0];
        rectangles.push(rectangle);
        return;
      }
      let partition = MathUtils.findPartition(elements);
      let aRectangle, bRectangle;
      if (rectangle.width >= rectangle.height) {
        let lWidth = rectangle.width * partition.aPercentage;
        let rWidth = rectangle.width * partition.bPercentage;
        aRectangle = new Rectangle(rectangle.left, rectangle.top, lWidth, rectangle.height);
        bRectangle = new Rectangle(rectangle.left + lWidth, rectangle.top, rWidth, rectangle.height);
      } else {
        let uHeight = rectangle.height * partition.aPercentage;
        let bHeight = rectangle.height * partition.bPercentage;
        aRectangle = new Rectangle(rectangle.left, rectangle.top, rectangle.width, uHeight);
        bRectangle = new Rectangle(rectangle.left, rectangle.top + uHeight, rectangle.width, bHeight);
      }
      this._split(partition.a, aRectangle, rectangles);
      this._split(partition.b, bRectangle, rectangles);
    }
  }
  treemapChart[Heatmap] = Heatmap;

  if (typeof jQuery != 'undefined') {
    (function($) {
      $.fn.treemap = function(params) {
        if (!this[0]) {
          throw "Treemap was called with no elements to draw!";
        }
        let heatmap = new Heatmap(params.treemapConfig, params.data);
        let render;
        switch (params.render) {
          case "canvas":
            render = new CanvasRenderer(params.renderConfig);
            break;
          case "html":
          default:
            render = new HTMLRenderer(params.renderConfig);
        }
        render.render(heatmap.heatmapModel(), this[0]);
      }
    }(jQuery))
  }
})();
