# Country masthead figure contract

The hero section owns one semantic figure whenever engraving art exists. The figure owns the decorative light/dark image layers and the visible figcaption. The caption is rendered whenever art exists, independent of landmark-caption availability.

The figure wrapper has no layout box. Its contents participate in the hero grid directly. The image remains the absolute backdrop. The caption remains grid column 1/-1 in the final auto-sized row. The title/stat register and media controls cannot enter that row. Mobile keeps its existing in-flow image and caption order.

Parallax measures the nearest section so adding or removing semantic wrappers cannot change the scroll target. Any future wrapper that creates a layout box or any caption positioning that abandons the reserved row requires a new design-system decision and geometry evidence.
