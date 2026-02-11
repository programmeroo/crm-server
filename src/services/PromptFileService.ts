import fs from 'fs/promises';
import path from 'path';
import { logger } from '../config/logger';
import { AppError } from '../errors/AppError';
import matter from 'gray-matter';

interface PromptData {
  workspaceId: number;
  listId?: number | null;
  name: string;
  description?: string;
  content: string;
}

interface Prompt extends PromptData {
  filename: string;
  createdAt: string;
  updatedAt: string;
}

export class PromptFileService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), 'data', 'prompts');
  }

  /**
   * Ensure directory exists, creating if necessary
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
      throw new AppError('FILE_ERROR', `Failed to create directory: ${dirPath}`, 500);
    }
  }

  /**
   * Convert text to URL-safe slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .slice(0, 100); // Limit to 100 chars
  }

  /**
   * Generate filename from workspace/list/name
   */
  private generateFilename(workspaceId: number, listId: number | null | undefined, name: string): string {
    const listPart = listId ? `${listId}` : 'global';
    const namePart = this.slugify(name);
    return `${workspaceId}-${listPart}-${namePart}.md`;
  }

  /**
   * Get directory path for workspace and list
   */
  private getWorkspaceListDir(workspaceId: number, listId: number | null | undefined): string {
    const listDirPart = listId ? `${listId}` : 'global';
    return path.join(this.baseDir, `${workspaceId}`, listDirPart);
  }

  /**
   * Parse markdown file and extract frontmatter + content
   */
  private parseMarkdownFile(fileContent: string): { frontmatter: any; content: string } {
    const { data, content } = matter(fileContent);
    return { frontmatter: data, content };
  }

  /**
   * Generate markdown with YAML frontmatter
   */
  private generateMarkdown(frontmatter: any, content: string): string {
    const yaml = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}: "${value}"`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');

    return `---\n${yaml}\n---\n\n${content}`;
  }

  /**
   * Create a new prompt
   */
  async create(data: PromptData): Promise<Prompt> {
    try {
      const now = new Date().toISOString();
      const filename = this.generateFilename(data.workspaceId, data.listId, data.name);
      const filePath = path.join(this.getWorkspaceListDir(data.workspaceId, data.listId), filename);

      // Check if prompt already exists
      try {
        await fs.access(filePath);
        throw new AppError(
          'DUPLICATE',
          'A prompt with this name already exists in this workspace/list',
          409
        );
      } catch (err) {
        if (err instanceof AppError) throw err;
        // File doesn't exist, which is what we want
      }

      // Ensure directory exists
      await this.ensureDirectoryExists(path.dirname(filePath));

      // Create frontmatter
      const frontmatter = {
        workspace_id: data.workspaceId,
        list_id: data.listId || null,
        name: data.name,
        description: data.description || null,
        created_at: now,
        updated_at: now,
      };

      // Generate markdown and write file
      const markdown = this.generateMarkdown(frontmatter, data.content);
      await fs.writeFile(filePath, markdown, 'utf-8');

      logger.info('Prompt created', { filename, workspaceId: data.workspaceId });

      return {
        ...data,
        filename,
        createdAt: now,
        updatedAt: now,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('FILE_ERROR', 'Failed to create prompt', 500);
    }
  }

  /**
   * Find prompt by filename
   */
  async findByFilename(filename: string): Promise<Prompt | null> {
    try {
      // Search for file in all workspaces
      const workspaceDirs = await fs.readdir(this.baseDir);

      for (const workspaceDir of workspaceDirs) {
        const workspacePath = path.join(this.baseDir, workspaceDir);
        const stat = await fs.stat(workspacePath);

        if (!stat.isDirectory()) continue;

        // Search in global and list subdirectories
        const subDirs = await fs.readdir(workspacePath);
        for (const subDir of subDirs) {
          const filePath = path.join(workspacePath, subDir, filename);
          try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const { frontmatter, content } = this.parseMarkdownFile(fileContent);

            return {
              workspaceId: parseInt(workspaceDir, 10),
              listId: subDir === 'global' ? null : parseInt(subDir, 10),
              name: frontmatter.name,
              description: frontmatter.description || null,
              content,
              filename,
              createdAt: frontmatter.created_at,
              updatedAt: frontmatter.updated_at,
            };
          } catch (err) {
            // File not found in this path, continue searching
          }
        }
      }

      return null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('FILE_ERROR', 'Failed to find prompt', 500);
    }
  }

  /**
   * List prompts by workspace
   */
  async listByWorkspace(workspaceId: number): Promise<Prompt[]> {
    try {
      const prompts: Prompt[] = [];
      const workspacePath = path.join(this.baseDir, `${workspaceId}`);

      try {
        const subDirs = await fs.readdir(workspacePath);

        for (const subDir of subDirs) {
          const subDirPath = path.join(workspacePath, subDir);
          const stat = await fs.stat(subDirPath);

          if (!stat.isDirectory()) continue;

          const files = await fs.readdir(subDirPath);

          for (const file of files) {
            if (!file.endsWith('.md')) continue;

            const filePath = path.join(subDirPath, file);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const { frontmatter, content } = this.parseMarkdownFile(fileContent);

            prompts.push({
              workspaceId,
              listId: subDir === 'global' ? null : parseInt(subDir, 10),
              name: frontmatter.name,
              description: frontmatter.description || null,
              content,
              filename: file,
              createdAt: frontmatter.created_at,
              updatedAt: frontmatter.updated_at,
            });
          }
        }
      } catch (err) {
        // Workspace directory doesn't exist yet, return empty array
      }

      // Sort by updated_at descending
      return prompts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('FILE_ERROR', 'Failed to list prompts', 500);
    }
  }

  /**
   * List prompts by workspace and list
   */
  async listByWorkspaceAndList(workspaceId: number, listId: number | null): Promise<Prompt[]> {
    try {
      const allPrompts = await this.listByWorkspace(workspaceId);
      return allPrompts.filter(p => {
        if (listId === null) {
          return p.listId === null;
        }
        return p.listId === listId;
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('FILE_ERROR', 'Failed to list prompts by list', 500);
    }
  }

  /**
   * Update prompt
   */
  async update(
    filename: string,
    workspaceId: number,
    data: Partial<PromptData>
  ): Promise<Prompt> {
    try {
      // Find the existing prompt
      const existing = await this.findByFilename(filename);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Prompt not found', 404);
      }

      if (existing.workspaceId !== workspaceId) {
        throw new AppError('FORBIDDEN', 'Prompt does not belong to this workspace', 403);
      }

      // Prepare updated data
      const now = new Date().toISOString();
      const updatedData: PromptData = {
        workspaceId: existing.workspaceId,
        listId: existing.listId,
        name: data.name || existing.name,
        description: data.description !== undefined ? data.description : existing.description,
        content: data.content || existing.content,
      };

      // Delete old file if name changed
      const newFilename = this.generateFilename(
        updatedData.workspaceId,
        updatedData.listId,
        updatedData.name
      );
      const oldFilePath = path.join(
        this.getWorkspaceListDir(existing.workspaceId, existing.listId),
        filename
      );
      const newFilePath = path.join(
        this.getWorkspaceListDir(updatedData.workspaceId, updatedData.listId),
        newFilename
      );

      // Ensure directory exists for new file
      await this.ensureDirectoryExists(path.dirname(newFilePath));

      // Create updated frontmatter
      const frontmatter = {
        workspace_id: updatedData.workspaceId,
        list_id: updatedData.listId || null,
        name: updatedData.name,
        description: updatedData.description || null,
        created_at: existing.createdAt,
        updated_at: now,
      };

      // Generate markdown and write to new location
      const markdown = this.generateMarkdown(frontmatter, updatedData.content);
      await fs.writeFile(newFilePath, markdown, 'utf-8');

      // Delete old file if it's different from new one
      if (oldFilePath !== newFilePath) {
        try {
          await fs.unlink(oldFilePath);
        } catch (err) {
          // File might not exist, ignore
        }
      }

      logger.info('Prompt updated', { filename: newFilename, workspaceId });

      return {
        ...updatedData,
        filename: newFilename,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('FILE_ERROR', 'Failed to update prompt', 500);
    }
  }

  /**
   * Delete prompt
   */
  async delete(filename: string, workspaceId: number): Promise<void> {
    try {
      const prompt = await this.findByFilename(filename);
      if (!prompt) {
        throw new AppError('NOT_FOUND', 'Prompt not found', 404);
      }

      if (prompt.workspaceId !== workspaceId) {
        throw new AppError('FORBIDDEN', 'Prompt does not belong to this workspace', 403);
      }

      const filePath = path.join(
        this.getWorkspaceListDir(prompt.workspaceId, prompt.listId),
        filename
      );

      await fs.unlink(filePath);
      logger.info('Prompt deleted', { filename, workspaceId });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('FILE_ERROR', 'Failed to delete prompt', 500);
    }
  }
}
