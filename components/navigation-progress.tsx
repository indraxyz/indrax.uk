import { useEffect, useRef } from "react"
import { useLocation, useNavigation } from "react-router"
import { useIsFetching } from "@tanstack/react-query"
import LoadingBar, { type LoadingBarRef } from "react-top-loading-bar"

/** Non-blocking progress for routes and uncached reads; local states announce API loading. */
export function NavigationProgress() {
  const navigation = useNavigation()
  const location = useLocation()
  const initialQueries = useIsFetching({
    predicate: (query) => query.getObserversCount() > 0 && query.state.data === undefined,
  })
  const busy = navigation.state !== "idle" || initialQueries > 0
  const bar = useRef<LoadingBarRef>(null)
  const started = useRef(false)
  const navigationKey = navigation.location?.key ?? location.key

  useEffect(() => {
    if (busy) {
      started.current = true
      bar.current?.continuousStart()
    } else if (started.current) {
      started.current = false
      bar.current?.complete()
    }
  }, [busy, navigationKey, navigation.state])

  return (
    <>
      <LoadingBar
        key={navigationKey}
        ref={bar}
        color="var(--component-navigation-progress)"
        height={3}
        shadow={false}
        waitingTime={150}
        containerClassName="navigation-progress"
        containerStyle={{ zIndex: 100 }}
      />
      {navigation.state !== "idle" && (
        <span role="status" className="sr-only">
          Loading page
        </span>
      )}
    </>
  )
}
