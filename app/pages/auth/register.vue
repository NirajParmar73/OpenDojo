<script setup lang="ts">
import type {FormSubmitEvent} from '@nuxt/ui'
import {z} from 'zod/v4'

const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 charachters long'),    
    passwordConfirm: z.string()
}).check ((data)=>{
    if(data.value.password !== data.value.passwordConfirm){
        data.issues.push({
            code: 'custom',
            path: ['passwordConfirm'],
            message: 'Passwords do not match',
            input: data.value.passwordConfirm
        })
    }
})

type Schema = z.output<typeof schema>;

const state = reactive({
    name: '',
    email: '',
    password: '',
    passwordConfirm: ''
})

const toast = useToast()
const loading = ref(false)

async function onRegister(event: FormSubmitEvent<Schema>) {
   try {
    loading.value= true
    const response = await $fetch('/api/auth/register', {
        method: 'POST',
        body: {
            name: event.data.name,
            email: event.data.email,
            password: event.data.password
        }
    })

    if(!response.success){
        throw new Error('Registration Error')
    }

    navigateTo('/')

   } catch (error) {
    toast.add({
        color: 'error',
        title: 'Failed to create account',
        description: 'Please check your details and try again'
    })
   }
   finally{
    loading.value=false
   }
}
</script>
<template>
    <div class="max-w-100 mx-auto">
        <h1 class="text-center">Register</h1>
        <UForm :schema :state @submit="onRegister" class="space-y-3">
            <UFormField name="name" label="Name">
                <UInput class="w-full" v-model="state.name" placeholder="Enter you name" required/>
            </UFormField>
            <UFormField name="email" label="Email Address">
                <UInput class="w-full" v-model="state.email" type="email" placeholder="Enter you Email" required/>
            </UFormField>
            <UFormField name="password" label="Password">
                <UInput class="w-full" v-model="state.password" type="password" placeholder="Enter you password" required/>
            </UFormField>
            <UFormField name="passwordConfirm" label="Email Address">
                <UInput class="w-full" v-model="state.passwordConfirm" type="password" placeholder="Confirm your password" required/>
            </UFormField>
            <UButton :loading type="submit">
                Register
            </UButton>
        </UForm>
    </div>
</template>