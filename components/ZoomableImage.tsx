import React, { Component } from "react";
import { View, PanResponder, Image, LayoutChangeEvent, ImageSourcePropType, PanResponderInstance, ViewStyle } from "react-native";
import Character from './Character';

function calcDistance(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.abs(x1 - x2);
  const dy = Math.abs(y1 - y2);
  return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
}

function calcCenter(x1: number, y1: number, x2: number, y2: number) {
  function middle(p1: number, p2: number) {
    return p1 > p2 ? p1 - (p1 - p2) / 2 : p2 - (p2 - p1) / 2;
  }

  return {
    x: middle(x1, x2),
    y: middle(y1, y2)
  };
}

function maxOffset(offset: number, windowDimension: number, imageDimension: number) {
  const max = windowDimension - imageDimension;
  if (max >= 0) {
    return 0;
  }
  return offset < max ? max : offset;
}

function calcOffsetByZoom(width: number, height: number, imageWidth: number, imageHeight: number, zoom: number) {
  const xDiff = imageWidth * zoom - width;
  const yDiff = imageHeight * zoom - height;
  return {
    left: -xDiff / 2,
    top: -yDiff / 2
  };
}

interface ZoomableImageProps {
  source: ImageSourcePropType,
  imageHeight: number,
  imageWidth: number,
  style?: ViewStyle,
}

interface ZoomableImageState {
  zoom: number,
  minZoom: number,
  layoutKnown: boolean,
  isZooming: boolean,
  isMoving: boolean,
  initialDistance: number,
  initialX: number,
  initialY: number,
  offsetTop: number,
  offsetLeft: number,
  initialTop: number,
  initialLeft: number,
  initialTopWithoutZoom: number,
  initialLeftWithoutZoom: number,
  initialZoom: number,
  top: number,
  left: number,
  width: number,
  height: number,
}

// function handlePanResponderMove(event: Object, gestureState: Object): void {
//   if (isSwipingExcessivelyRightFromClosedPosition(gestureState)) {
//     return;
//   }
//   this.props.onSwipeStart();
//   if (this._isSwipingRightFromClosed(gestureState)) {
//     this._swipeSlowSpeed(gestureState);
//   } else {
//     this._swipeFullSpeed(gestureState);
//   }
// }

// function isSwipingRightFromClosed(gestureState: Object): boolean {
//   const gestureStateDx = IS_RTL ? -gestureState.dx : gestureState.dx;
//   return this._previousLeft === CLOSED_LEFT_POSITION && gestureStateDx > 0;
// }

// function swipeFullSpeed(gestureState: Object): void {
//   this.state.currentLeft.setValue(this._previousLeft + gestureState.dx);
// }

// function swipeSlowSpeed(gestureState: Object): void {
//   this.state.currentLeft.setValue(
//     this._previousLeft + gestureState.dx / SLOW_SPEED_SWIPE_FACTOR,
//   );
// }

// function isSwipingExcessivelyRightFromClosedPosition(gestureState: Object): boolean {
//   const gestureStateDx = IS_RTL ? -gestureState.dx : gestureState.dx;
//   return (
//     this._isSwipingRightFromClosed(gestureState) &&
//     gestureStateDx > RIGHT_SWIPE_THRESHOLD
//   );
// }

export class ZoomableImage extends Component<ZoomableImageProps, ZoomableImageState> {

  _panResponder?: PanResponderInstance;

  public static defaultProps = {
    imageHeight: 0,
    imageWidth: 0,
  };

  constructor(props: ZoomableImageProps = {
    source: {}, // TODO
    imageHeight: 0,
    imageWidth: 0,
    style: {},
  }) {
    super(props);

    this._onLayout = this._onLayout.bind(this);

    this.state = {
      zoom: 0,
      minZoom: 0,
      layoutKnown: false,
      isZooming: false,
      isMoving: false,
      initialDistance: 0,
      initialX: 0,
      initialY: 0,
      offsetTop: 0,
      offsetLeft: 0,
      initialTop: 0,
      initialLeft: 0,
      initialTopWithoutZoom: 0,
      initialLeftWithoutZoom: 0,
      initialZoom: 1,
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    };
  }


  processPinch(x1: number, y1: number, x2: number, y2: number) {
    const distance = calcDistance(x1, y1, x2, y2);
    const center = calcCenter(x1, y1, x2, y2);

    if (!this.state.isZooming) {
      const offsetByZoom = calcOffsetByZoom(
        this.state.width,
        this.state.height,
        this.props.imageWidth,
        this.props.imageHeight,
        this.state.zoom
      );
      this.setState({
        isZooming: true,
        initialDistance: distance,
        initialX: center.x,
        initialY: center.y,
        initialTop: this.state.top,
        initialLeft: this.state.left,
        initialZoom: this.state.zoom,
        initialTopWithoutZoom: this.state.top - offsetByZoom.top,
        initialLeftWithoutZoom: this.state.left - offsetByZoom.left
      });
    } else {
      const touchZoom = distance / this.state.initialDistance;
      const zoom =
        touchZoom * this.state.initialZoom > this.state.minZoom
          ? touchZoom * this.state.initialZoom
          : this.state.minZoom;

      const offsetByZoom = calcOffsetByZoom(
        this.state.width,
        this.state.height,
        this.props.imageWidth,
        this.props.imageHeight,
        zoom
      );
      const left =
        this.state.initialLeftWithoutZoom * touchZoom + offsetByZoom.left;
      const top =
        this.state.initialTopWithoutZoom * touchZoom + offsetByZoom.top;

      this.setState({
        zoom,
        left:
          left > 0
            ? 0
            : maxOffset(left, this.state.width, this.props.imageWidth * zoom),
        top:
          top > 0
            ? 0
            : maxOffset(top, this.state.height, this.props.imageHeight * zoom)
      });
    }
  }

  processTouch(x: number, y: number) {
    if (!this.state.isMoving) {
      this.setState({
        isMoving: true,
        initialX: x,
        initialY: y,
        initialTop: this.state.top,
        initialLeft: this.state.left
      });
    } else {
      const left = this.state.initialLeft + x - this.state.initialX;
      const top = this.state.initialTop + y - this.state.initialY;

      this.setState({
        left:
          left > 0
            ? 0
            : maxOffset(
              left,
              this.state.width,
              this.props.imageWidth * this.state.zoom
            ),
        top:
          top > 0
            ? 0
            : maxOffset(
              top,
              this.state.height,
              this.props.imageHeight * this.state.zoom
            )
      });
    }
  }

  _onLayout(event: LayoutChangeEvent) {
    const layout = event.nativeEvent.layout;

    if (
      layout.width === this.state.width &&
      layout.height === this.state.height
    ) {
      return;
    }

    const zoom = layout.width / this.props.imageWidth;

    const offsetTop =
      layout.height > this.props.imageHeight * zoom
        ? (layout.height - this.props.imageHeight * zoom) / 2
        : 0;

    this.setState({
      layoutKnown: true,
      width: layout.width,
      height: layout.height,
      zoom,
      offsetTop,
      minZoom: zoom
    });
  }

  componentWillMount() {
    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => { },
      onPanResponderMove: evt => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          this.processPinch(
            touches[0].pageX,
            touches[0].pageY,
            touches[1].pageX,
            touches[1].pageY
          );
        } else if (touches.length === 1 && !this.state.isZooming) {
          this.processTouch(touches[0].pageX, touches[0].pageY);
        }
      },

      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: () => {
        this.setState({
          isZooming: false,
          isMoving: false
        });
      },
      onPanResponderTerminate: () => { },
      onShouldBlockNativeResponder: () => true
    });
  }


  render() {
    return (
      <View
        style={this.props.style}
        {...this._panResponder?.panHandlers}
        onLayout={this._onLayout}
      >
        <Image
          style={{
            position: "absolute",
            top: this.state.offsetTop + this.state.top,
            left: this.state.offsetLeft + this.state.left,
            width: this.props.imageWidth * this.state.zoom,
            height: this.props.imageHeight * this.state.zoom,
            zIndex: 0,
          }}
          source={this.props.source}
        />
        <Character />
      </View>
    );
  }
}

export default ZoomableImage;