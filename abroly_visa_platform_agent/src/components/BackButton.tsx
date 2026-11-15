import { Button } from "@heroui/react"
import { ArrowLeft, ChevronLeft } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'

const BackButton = ({ title, showTitle = false }) => {
    const navigate = useNavigate()
    return (
        <div className='flex flex-row items-center w-fit gap-2'>
            <Button
                isIconOnly
                variant='flat'
                size='sm'
                onPress={() => {
                    navigate(-1)
                }}
                className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
            >
                <ChevronLeft className="w-4 h-4" />
            </Button>
            {showTitle && title && <p className="text-white font-medium">{title}</p>}
        </div>
    )
}

export default BackButton