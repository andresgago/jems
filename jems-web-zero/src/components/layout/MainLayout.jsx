import Navbar from './Navbar';

export default function MainLayout({ children }) {
  return (
    <>
      <Navbar />
      <div className="main-content">
        <div className="container-fluid px-3">
          {children}
        </div>
      </div>
      <footer className="site-footer">
        <div className="container text-center">
          <strong>JEMS &copy; 2019 – {new Date().getFullYear()}</strong>
        </div>
      </footer>
    </>
  );
}
