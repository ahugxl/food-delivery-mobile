import { forwardRef, useState } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';

// One touch treatment for buttons, filters and icon actions throughout the app.
export const AppPressable = forwardRef<View, PressableProps>(
  function AppPressable(
    { style, disabled, onPressIn, onPressOut, onHoverIn, onHoverOut, ...props },
    ref,
  ) {
    const [pressed, setPressed] = useState(false);
    const [hovered, setHovered] = useState(false);
    return (
      <Pressable
        {...props}
        ref={ref}
        disabled={disabled}
        onHoverIn={(event) => {
          setHovered(true);
          onHoverIn?.(event);
        }}
        onHoverOut={(event) => {
          setHovered(false);
          onHoverOut?.(event);
        }}
        onPressIn={(event) => {
          setPressed(true);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          setPressed(false);
          onPressOut?.(event);
        }}
        style={[
          typeof style === 'function' ? style({ pressed, hovered }) : style,
          { opacity: disabled ? 0.5 : pressed ? 0.78 : 1 },
        ]}
      />
    );
  },
);
