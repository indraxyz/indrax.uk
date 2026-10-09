import { useEffect, useRef } from "react"
import { useLocation, useNavigation } from "react-router"
import { useIsFetching } from "@tanstack/react-query"
import LoadingBar, { type LoadingBarRef } from "react-top-loading-bar"
import { PageLoading } from "@/components/page-loading"

/** One indicator for route transitions and first-load API data, not background refreshes. */
export function NavigationProgress({ initialSpinner = true }: { initialSpinner?: boolean }) {
  const navigation = useNavigation()
  const location = useLocation()
  const initialVisit = useRef(true)
  const initialQueries = useIsFetching({
    predicate: (query) => query.getObserversCount() > 0 && query.state.data === undefined,
  })
  const initial = initialVisit.current && navigation.state === "idle"
  const busy = navigation.state !== "idle" || (!initial && initialQueries > 0)
  const bar = useRef<LoadingBarRef>(null)
  const started = useRef(false)
  const navigationKey = navigation.location?.key ?? location.key

  useEffect(() => {
    if (navigation.state !== "idle") initialVisit.current = false
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
      {initialSpinner && initial && initialQueries > 0 && <PageLoading />}
      {busy && (
        <span role="status" className="sr-only">
          Loading page
        </span>
      )}
    </>
  )
}
