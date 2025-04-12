

const ActivityCard = (props) => {
    return (
        <div className="card bg-primary text-primary-content w-96">
            <div className="card-body items-center">
                <h2 className="card-title text-emerald-400">{props.activity}</h2>
                <p>{props.description}</p>
            </div>
        </div>
    )
}

export default ActivityCard