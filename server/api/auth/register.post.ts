import {z} from 'zod'

const registerSchema = z.object({

    email: z.email(),
    name: z.string().min(1, 'Name is required').max(255),
    password: z.string().min(8, 'Password must be at least 8 characters long'),

})
export default defineEventHandler(async (event)=>{
    const body = await readValidatedBody(event, registerSchema.parse)
    const hashedPassword = await hashPassword(body.password)

    const [user] = await db.insert(tables.users).values({
        name: body.name,
        email: body.email,
        passwordHash: hashedPassword,
    }).returning()

    await setUserSession(event, {
        user:{
            id: user?.id,
            name: user?.name
        },
        lastLoggedIn: new Date()
    })

    return{success: true}
})