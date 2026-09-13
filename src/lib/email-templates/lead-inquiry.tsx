import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  email?: string
}

const Email = ({ name, email }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New Golfixation inquiry from ${name || 'someone'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>New tournament inquiry</Heading>
        <Text style={text}>Someone is interested in using Golfixation for their tournament.</Text>
        <Section style={card}>
          <Text style={label}>Name</Text>
          <Text style={value}>{name || 'Not provided'}</Text>
          <Hr style={hr} />
          <Text style={label}>Email</Text>
          <Text style={value}>{email || 'Not provided'}</Text>
        </Section>
        <Text style={footer}>Sent from the Golfixation homepage.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'New Golfixation tournament inquiry',
  displayName: 'Lead inquiry',
  previewData: { name: 'Jane Doe', email: 'jane@example.com' },
  to: 'erikfrye@gmail.com',
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const heading = { fontSize: '22px', color: '#14532d', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#1f2937', margin: '0 0 16px' }
const card = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '16px 20px',
  backgroundColor: '#f9fafb',
}
const label = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#6b7280',
  margin: '0 0 2px',
}
const value = { fontSize: '15px', color: '#111827', margin: '0' }
const hr = { borderColor: '#e5e7eb', margin: '14px 0' }
const footer = { fontSize: '12px', color: '#6b7280', marginTop: '20px' }
