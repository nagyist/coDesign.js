(function(){

	var id = 1;

	$.coDesign.CanvasDraw = function( options ){
		var _=this;
				
		_.id = id++;
		_.canvas = options.canvas;
		_.size = options.size;
		_.updateColor(options.color || {});
		_.updateBrush(options.brush || {});
		_.isActive = false;
		_.erase = false;
		_.points = [];
	};

	// public methods
	$.coDesign.CanvasDraw.prototype = {

		begin: function(options){
			this.isActive = true;
			return this;
		},

		complete: function(){
			this.isActive = false;
			this.points = [];
			return this;
		},

		draw: function(instructions){
			var command, color, brush, size, _ = this;

			if( !_.isActive ) return _;

			if (_.erase) {
				_.canvas.getContext('2d').clearRect ( instructions.x-(_.size/2), instructions.y-(_.size/2), _.size, _.size );
				return _;
			}

			_.color = color = instructions.color || _getColor(_);
		
			brush = instructions.brush || _getBrush(_);

			command = {
				x: instructions.x,
				y: instructions.y,
				color: color,
				brush: brush
			};

			_.brush = brush;

			_draw(_, command);
			return _;
		},

		updateColor: function(options){
		    var _ = this;
		
			if( typeof options === 'string'){
				_.colorOptions = {};
				_.color = options;
				_.colors = null;
			} else {
				_.colorOptions = options || {};
				_.colors = new $.coDesign.ColorArray(_.colorOptions);
			}
		},

		updateBrush: function(options){
			var i, _ = this;
			
			if(options) _.brushOptions = options;
				
			_.brushes = _makeBrushGradient(_.brushOptions, _.size);
			_.brushLength = _.brushes.length;

			_.brushCyclePos = 0;
			_.brushReverse = false;
		},
		
		setErase: function(bool){
			this.erase = bool === void 0 ? true : bool;
		}
	};

	// private methods

	function _getColor(_){
		if(!_.colors){
			return _.color;
		}
		return _.colors.next();
	}

	function _getBrush(_){
		var i;
		if( _.brushReverse ){
			if (_.brushCyclePos === 0 ){
				i = 1;
				_.brushReverse = false;
			} else {
				i = -1;
				_.brushReverse = true;
			}
		} else {
			if(_.brushCyclePos === _.brushLength){
				i = -1;
				_.brushReverse = true;
			} else{
				i = 1;
				_.brushReverse = false;
			}
		}
		return _.brushes[_.brushCyclePos+=i];
	}

	function _makeBrushGradient(o, size){ // for waveyness

		var i = 0,
			len					= o.len || 4,
			spin				= o.spin/360 || 20/360,
			points				= o.points || 7,
			layers 				= o.layers || 4,
			
			radiusOpts 			= o.size || {max:.5, min:null, wave: null},
			radiusAmplitude		= Math.ceil(size*(radiusOpts.min||.1)),
			radiusCenter		= Math.ceil(size*(radiusOpts.max||.1)),
			
			pressure 			= o.pressure || {max:4, min:2, wave:.3},
			
			brush 				= [],

			layers, radius, lineWidth;

		for (; i++ < len;){
			if(radiusOpts.wave && radiusAmplitude){
				radius = Math.ceil(Math.sin(radiusOpts.wave*i) * radiusAmplitude + radiusCenter);
			} else {
				radius = size;
			}
			if(pressure.wave && pressure.max){
				lineWidth = Math.sin(pressure.wave*i) * pressure.max + pressure.min;	
			}else{
				lineWidth = pressure.max || 2;
			}

			brush.push({
				layers : layers,
				pointsPerLayer: points,
				lineWidth: lineWidth,
				size: radius,
				spinDegree: o.spin,
				spin: spin,
				widthRatio: o.widthRatio || 1,
				heightRatio: o.heightRatio || 1,
				radiusOpts: radiusOpts,
				pressure: pressure,
				connectLines: o.connectLines,
				randomizeSpin: o.randomizeSpin,
				randomizePoints: o.randomizePoints
			});
		}

		return brush;
	}

	function _draw(_, command ){

		// adapted from: http://www.pixelwit.com/blog/2007/06/basic-circle-drawing-actionscript/

		if (!command.brush) return;
		if (!command.color) return;

		var context 		= _.canvas.getContext('2d'),
			brush			= command.brush,
			centerX 		= command.x,
			centerY 		= command.y,
			radius 			= brush.size,
			sides 			= brush.pointsPerLayer,
			spin			= brush.spin,
			layers 			= (brush.layers >= radius) ? radius : brush.layers,
			incrementRadiusBy 	= Math.floor(radius/layers) || 1;

		context.lineWidth = brush.lineWidth;
		context.strokeStyle = typeof command.color === 'string'
					? command.color
					: "rgba("+command.color.r+","+command.color.g+","+command.color.b+","+(brush.pressure.softness || 1)+")";

		context.beginPath();

		do{

			_drawOval({
				centerX:centerX,
				centerY:centerY,
				radiusX: radius * brush.heightRatio,
				radiusY: radius * brush.widthRatio,
				spin: brush.randomizeSpin ? Math.floor(Math.random() * (brush.spinDegree+1))/360 : spin,
				steps: brush.randomizePoints ? Math.floor(Math.random() * sides+1) : sides,
				layers:layers,
				drawMethod: function(i, xx, yy){

					var connectWithPrevious = brush.connectLines !== false;
					var xy = {};

					if(brush.pressure.randomize){
						context.lineWidth = Math.floor(Math.random() * (brush.lineWidth+1));
					}

					if(!_.points[layers]) _.points[layers] = [];
					
					if( !_.points[layers][i] || !connectWithPrevious){
						xy.x = xx-1;
						xy.y = yy-1;
					}
					else {
						xy.x = _.points[layers][i].x;
						xy.y =  _.points[layers][i].y;
					}
					
					_.points[layers][i] = {
						x: xx,
						y: yy
					};
					
					context.moveTo( xy.x, xy.y );
					context.lineTo(xx, yy);
				}
			});

			radius -= incrementRadiusBy;
			layers--;

		} while(layers)

		context.stroke();

	};

	function _drawOval(options) { // a rotated oval
		var centerX 		= options.centerX,
			centerY 	= options.centerY,
			radiusX 	= options.radiusX,
			radiusY 	= options.radiusY,
			spin 		= options.spin,
			steps 		= options.steps,
			drawMethod 	= options.drawMethod,
			i,
			radian,
			radianSin,
			radianCos,
			arrayOfPoints 	= [],
			spinRadians 	= spin * 2 * Math.PI,
			spinSin 	= Math.sin(spinRadians),
			spinCos 	= Math.cos(spinRadians),
			xx 		= centerX + spinCos * radiusX,
			yy 		= centerY + spinSin * radiusY;

		for (i=1; i<=steps; i++) {
			radian = i/steps * 2 * Math.PI;
			radianSin = Math.sin(radian);
			radianCos = Math.cos(radian);

			xx = centerX+(radiusX*radianCos*spinCos-radiusY*radianSin*spinSin);
			yy = centerY+(radiusX*radianCos*spinSin+radiusY*radianSin*spinCos);

			drawMethod(i, xx, yy);
		}
	};

}());