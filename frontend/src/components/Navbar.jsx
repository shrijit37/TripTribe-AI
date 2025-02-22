
const Navbar = () => {
    return (
        <>
            <nav className="flex justify-between items-center w-[92%] mx-auto my-4">
                <div className="">
                    <div className="text-5xl font-poppin">TripTribe</div>
                </div>

                {/* <div className="">
                    <ul className="">
                        <li className="">
                            <a href="" className="">Home</a>
                        </li>
                        <li className="">
                            <a href="" className=""></a>
                        </li>
                        <li className="">
                            <a href="" className=""></a>
                        </li>
                        <li className="">
                            <a href="" className=""></a>
                        </li>
                    </ul>
                </div> */}

                <div className="flex justify-between">
                    <button className="btn btn-primary mx-5">Try it! 💫</button>
                    <button className="btn btn-primary mx-5">Sign-in</button>
                </div>
            </nav>

        </>
    )
}

export default Navbar