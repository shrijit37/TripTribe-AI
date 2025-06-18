import FuzzyText from '../components/TextAnimations/FuzzyText/FuzzyText';

const NotFound = () => {
    return (
        <div className='w-[100%] flex items-center justify-center h-[90vh]' >
            <FuzzyText
                baseIntensity={0.2}
                hoverIntensity={0.5}
                enableHover={true}
            >
                404 : Not Found
            </FuzzyText>

        </div>
    )
}

export default NotFound