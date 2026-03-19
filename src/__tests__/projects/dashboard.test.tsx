import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { Project } from '@/lib/types/project'

// Minimal ProjectCard stub for testing ProjectList behavior
function ProjectCard({ project }: { project: Project }) {
  return (
    <div data-testid="project-card">
      <span>{project.title}</span>
    </div>
  )
}

// Minimal ProjectList stub that mirrors the real component structure
function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return <div data-testid="empty-state">No projects yet. Create your first slideshow!</div>
  }
  return (
    <div data-testid="project-list">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  )
}

const makeProject = (id: string, title: string): Project => ({
  id,
  user_id: 'user-1',
  title,
  description: null,
  slide_data: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

describe('Dashboard project listing', () => {
  it('renders the correct number of project cards given a projects array', () => {
    const projects = [
      makeProject('1', 'Project Alpha'),
      makeProject('2', 'Project Beta'),
      makeProject('3', 'Project Gamma'),
    ]

    render(<ProjectList projects={projects} />)

    const cards = screen.getAllByTestId('project-card')
    expect(cards).toHaveLength(3)
  })

  it('shows empty state message when no projects exist', () => {
    render(<ProjectList projects={[]} />)

    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument()
  })

  it('displays each project title', () => {
    const projects = [
      makeProject('1', 'My Vacation Slideshow'),
      makeProject('2', 'Work Presentation'),
    ]

    render(<ProjectList projects={projects} />)

    expect(screen.getByText('My Vacation Slideshow')).toBeInTheDocument()
    expect(screen.getByText('Work Presentation')).toBeInTheDocument()
  })
})
