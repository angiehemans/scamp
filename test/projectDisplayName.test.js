import { describe, it, expect } from 'vitest';
import { projectDisplayName } from '../src/renderer/lib/projectDisplayName';
describe('projectDisplayName', () => {
    describe('slug formats', () => {
        it('title-cases a kebab-case name: my-project-name', () => {
            expect(projectDisplayName('my-project-name')).toBe('My Project Name');
        });
        it('title-cases a snake_case name: my_project_name', () => {
            expect(projectDisplayName('my_project_name')).toBe('My Project Name');
        });
        it('title-cases a mixed kebab and snake name', () => {
            expect(projectDisplayName('my-project_name')).toBe('My Project Name');
        });
        it('capitalises a single word', () => {
            expect(projectDisplayName('portfolio')).toBe('Portfolio');
        });
        it('keeps digits as their own word: project-2', () => {
            expect(projectDisplayName('project-2')).toBe('Project 2');
        });
        it('does not split on dots, so a version stays intact', () => {
            expect(projectDisplayName('design-v1.2')).toBe('Design V1.2');
        });
    });
    describe('names that are already prose', () => {
        it('leaves an already title-cased name unchanged', () => {
            expect(projectDisplayName('My Project')).toBe('My Project');
        });
        it('capitalises a spaced lowercase name', () => {
            expect(projectDisplayName('my project')).toBe('My Project');
        });
    });
    describe('preserving what the user typed', () => {
        it('does not lowercase an existing acronym', () => {
            expect(projectDisplayName('my-API-client')).toBe('My API Client');
        });
        it('leaves interior capitals alone rather than splitting camelCase', () => {
            expect(projectDisplayName('myProjectName')).toBe('MyProjectName');
        });
    });
    describe('malformed and empty input', () => {
        it('returns an empty string unchanged', () => {
            expect(projectDisplayName('')).toBe('');
        });
        it('returns a separators-only name unchanged rather than empty', () => {
            expect(projectDisplayName('---')).toBe('---');
        });
        it('collapses runs of separators', () => {
            expect(projectDisplayName('my--project__name')).toBe('My Project Name');
        });
        it('drops leading and trailing separators', () => {
            expect(projectDisplayName('-my-project-')).toBe('My Project');
        });
        it('drops surrounding whitespace', () => {
            expect(projectDisplayName('  my project  ')).toBe('My Project');
        });
    });
});
