import { Image } from "@tiptap/extension-image"
import { resizableMediaView } from "./resizable-media"

export const ResizableImage = Image.extend({
  addNodeView() {
    return (props) => resizableMediaView(props, "image")
  },
})
