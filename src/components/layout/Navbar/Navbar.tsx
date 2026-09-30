import "./Navbar.scss";

import logo from "../../../assets/images/logo-letras-blancas.svg"
import { Link } from "react-router";

export default function Navbar() {
    return (
        <header className="navbar">

            <div className="navbar__logo">

                <img src={logo} alt="Logo Municipalidad" />

            </div>

            <Link
              to="/login"
              className="navbar__button"
            >

                Acceder
                <span>→</span>

            </Link>

        </header>
    );
}