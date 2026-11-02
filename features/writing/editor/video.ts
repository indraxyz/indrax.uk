import { Youtube } from "@tiptap/extension-youtube"
import { resizableMediaView } from "./resizable-media"

import { normalizeYouTubeUrl, videoWidth } from "./video-url"

export { canonicalYouTubeEmbed, normalizeYouTubeUrl } from "./video-url"

/** Official YouTube node with an explicit, narrow URL and rendering contract. */
export const YoutubeVideo = Youtube.extend({
  addNodeView() {
    return (props) => resizableMediaView(props, "youtube")
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 640,
        parseHTML: (element) => videoWidth(element.parentElement?.getAttribute("data-video-width")),
      },
      height: {
        default: 360,
        parseHTML: (element) =>
          Math.round(
            (videoWidth(element.parentElement?.getAttribute("data-video-width")) * 9) / 16
          ),
      },
      fullWidth: {
        default: false,
        parseHTML: (element) => element.parentElement?.getAttribute("data-full-width") === "true",
      },
      title: {
        default: "YouTube video player",
        parseHTML: (element) => element.getAttribute("title"),
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: "div[data-youtube-video] iframe",
        getAttrs: (element) => {
          const src = normalizeYouTubeUrl(element.getAttribute("src") ?? "")
          return src ? { src } : false
        },
      },
    ]
  },
  addCommands() {
    return {
      setYoutubeVideo:
        (options) =>
        ({ commands }) => {
          const src = normalizeYouTubeUrl(options.src)
          if (!src) return false
          return commands.insertContent({ type: this.name, attrs: { ...options, src } })
        },
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const src = normalizeYouTubeUrl(typeof node.attrs.src === "string" ? node.attrs.src : "")
    const align = HTMLAttributes["data-align"]
    const width = videoWidth(node.attrs.width)
    const fullWidth = node.attrs.fullWidth === true
    const wrapper = {
      "data-youtube-video": "",
      "data-video-width": width,
      ...(fullWidth ? { "data-full-width": "true" } : {}),
      // Generate this one numeric sizing declaration; never forward stored CSS.
      style: `width: ${fullWidth ? "100%" : `${width}px`}`,
      ...(["left", "center", "right"].includes(align) ? { "data-align": align } : {}),
    }
    if (!src) return ["div", wrapper]
    const title =
      typeof node.attrs.title === "string" && node.attrs.title.trim()
        ? node.attrs.title.trim().slice(0, 200)
        : "YouTube video player"
    return [
      "div",
      wrapper,
      [
        "iframe",
        {
          src,
          title,
          loading: "lazy",
          referrerpolicy: "strict-origin-when-cross-origin",
          allow: "encrypted-media; picture-in-picture; fullscreen",
          allowfullscreen: "true",
        },
      ],
    ]
  },
}).configure({ nocookie: true, autoplay: false, addPasteHandler: false, inline: false })
