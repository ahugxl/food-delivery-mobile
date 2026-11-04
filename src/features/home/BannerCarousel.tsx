import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { AppPressable } from "../../components/AppPressable";
import type { Row } from "../../types/supabase";

export function BannerCarousel({
  banners,
  onPress,
}: {
  banners: Row<"banners">[];
  onPress: (banner: Row<"banners">) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState !== "background");
  const [reduceMotion, setReduceMotion] = useState(false);
  const slideWidth = width;
  const stride = width;
  const identity = banners.map((banner) => banner.id).join(",");
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    const app = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
    };
  }, []);
  useEffect(() => {
    setIndex(0);
    setDragging(false);
    scroll.current?.scrollTo({ x: 0, animated: false });
  }, [identity, width]);
  useEffect(() => {
    if (
      !width ||
      banners.length < 2 ||
      !focused ||
      !active ||
      dragging ||
      reduceMotion
    )
      return;
    const timer = setTimeout(() => {
      scroll.current?.scrollTo({
        x: ((index + 1) % banners.length) * stride,
        animated: true,
      });
    }, 4000);
    return () => clearTimeout(timer);
  }, [
    width,
    stride,
    index,
    banners.length,
    focused,
    active,
    dragging,
    reduceMotion,
  ]);
  // Artwork is designed for this 3:1 frame; no blurred background or side bars.
  const height = slideWidth ? slideWidth / 3 : 120;
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ borderRadius: 16, overflow: "hidden" }}
    >
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        snapToInterval={stride || 1}
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        scrollEventThrottle={32}
        onScrollBeginDrag={() => setDragging(true)}
        onScrollEndDrag={() => setDragging(false)}
        onMomentumScrollEnd={() => setDragging(false)}
        onScroll={(event) => {
          if (stride)
            setIndex(
              Math.max(
                0,
                Math.min(
                  banners.length - 1,
                  Math.round(event.nativeEvent.contentOffset.x / stride),
                ),
              ),
            );
        }}
      >
        {width > 0 &&
          banners.map((banner, position) => (
            <AppPressable
              key={banner.id}
              accessibilityRole="button"
              accessibilityLabel={`Xem ưu đãi ${position + 1} trên ${banners.length}`}
              onPress={() => onPress(banner)}
              style={{
                width: slideWidth,
                height,
                overflow: "hidden",
                backgroundColor: "#E5F0E5",
              }}
            >
              <Image
                source={{ uri: banner.image_url }}
                contentFit="cover"
                contentPosition="center"
                transition={180}
                style={{ width: slideWidth, height }}
              />
            </AppPressable>
          ))}
      </ScrollView>
      {banners.length > 1 && (
        <View
          style={{
            position: "absolute",
            zIndex: 2,
            bottom: 3,
            left: 0,
            width: slideWidth,
            flexDirection: "row",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {banners.map((banner, position) => (
            <AppPressable
              key={banner.id}
              accessibilityRole="button"
              accessibilityLabel={`Chuyển đến banner ${position + 1}`}
              accessibilityState={{ selected: position === index }}
              onPress={() =>
                scroll.current?.scrollTo({
                  x: position * stride,
                  animated: !reduceMotion,
                })
              }
              style={{
                minWidth: 24,
                height: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor:
                    position === index ? "#008B45" : "rgba(255,255,255,.9)",
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,.2)",
                }}
              />
            </AppPressable>
          ))}
        </View>
      )}
    </View>
  );
}
