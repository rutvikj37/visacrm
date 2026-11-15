/**
 * Full-screen loading state used by every startup stage (restoring the saved login, checking it,
 * loading the agency's branding). Every stage renders this same screen, so moving from one to the
 * next is invisible instead of flashing between different-looking loaders.
 *
 * - background = the page's own background (light and dark), so nothing changes colour when the app appears
 * - the spinner only fades in after 400ms (see .app-loader-spinner in index.css), so quick loads show no spinner at all
 */
const AppLoader = ({ label = "Loading" }: { label?: string }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background" role="status" aria-label={label}>
        <span className="app-loader-spinner" aria-hidden="true" />
    </div>
);

export default AppLoader;
