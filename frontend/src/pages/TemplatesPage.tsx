import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';

// Пока используем локальное хранилище для шаблонов
interface PostTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  tags: string[];
  variables: string[];
  createdAt: string;
  usageCount: number;
}

const TEMPLATE_CATEGORIES = [
  'Промо',
  'Обучение', 
  'Развлечения',
  'Новости',
  'Личное',
  'Продукт',
  'Другое'
];

const PREDEFINED_TEMPLATES: PostTemplate[] = [
  {
    id: '1',
    name: 'Промо пост',
    content: '🔥 Специальное предложение!\n\n{{offer_description}}\n\n✨ Успейте до {{deadline}}!\n\n#промо #скидка #{{product_tag}}',
    category: 'Промо',
    tags: ['промо', 'скидка', 'предложение'],
    variables: ['offer_description', 'deadline', 'product_tag'],
    createdAt: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: '2',
    name: 'Мотивационный пост',
    content: '💪 {{motivational_quote}}\n\n{{personal_story}}\n\nКакие у вас планы на {{time_period}}?\n\n#мотивация #цели #успех',
    category: 'Личное',
    tags: ['мотивация', 'цели', 'успех'],
    variables: ['motivational_quote', 'personal_story', 'time_period'],
    createdAt: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: '3',
    name: 'Образовательный контент',
    content: '📚 Сегодня разбираем: {{topic}}\n\n{{main_points}}\n\n💡 Ключевая мысль: {{key_insight}}\n\nСохраняйте пост, чтобы не потерять!\n\n#обучение #советы #{{topic_tag}}',
    category: 'Обучение',
    tags: ['обучение', 'советы', 'знания'],
    variables: ['topic', 'main_points', 'key_insight', 'topic_tag'],
    createdAt: new Date().toISOString(),
    usageCount: 0
  }
];

export const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<PostTemplate[]>(() => {
    const saved = localStorage.getItem('post_templates');
    return saved ? JSON.parse(saved) : PREDEFINED_TEMPLATES;
  });
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PostTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUseTemplate, setShowUseTemplate] = useState<PostTemplate | null>(null);
  
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    content: '',
    category: 'Другое',
    tags: [] as string[],
    tagInput: ''
  });

  const [templateVariables, setTemplateVariables] = useState<{[key: string]: string}>({});

  const queryClient = useQueryClient();

  // Сохранение в localStorage
  const saveTemplates = (updatedTemplates: PostTemplate[]) => {
    setTemplates(updatedTemplates);
    localStorage.setItem('post_templates', JSON.stringify(updatedTemplates));
  };

  // Создание шаблона
  const createTemplate = () => {
    if (!newTemplate.name || !newTemplate.content) {
      toast.error('Заполните название и содержимое шаблона');
      return;
    }

    const template: PostTemplate = {
      id: Date.now().toString(),
      name: newTemplate.name,
      content: newTemplate.content,
      category: newTemplate.category,
      tags: newTemplate.tags,
      variables: extractVariables(newTemplate.content),
      createdAt: new Date().toISOString(),
      usageCount: 0
    };

    const updatedTemplates = editingTemplate
      ? templates.map(t => t.id === editingTemplate.id ? { ...template, id: editingTemplate.id, usageCount: editingTemplate.usageCount } : t)
      : [...templates, template];

    saveTemplates(updatedTemplates);
    toast.success(editingTemplate ? 'Шаблон обновлен!' : 'Шаблон создан!');
    resetForm();
  };

  // Удаление шаблона
  const deleteTemplate = (id: string) => {
    const updatedTemplates = templates.filter(t => t.id !== id);
    saveTemplates(updatedTemplates);
    toast.success('Шаблон удален!');
  };

  // Извлечение переменных из текста
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map(match => match.slice(2, -2)))];
  };

  // Подстановка переменных
  const substituteVariables = (template: string, variables: {[key: string]: string}): string => {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    });
    return result;
  };

  // Фильтрация шаблонов
  const filteredTemplates = templates.filter(template => {
    const matchesCategory = !selectedCategory || template.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  const resetForm = () => {
    setNewTemplate({ name: '', content: '', category: 'Другое', tags: [], tagInput: '' });
    setEditingTemplate(null);
    setShowCreateForm(false);
  };

  const handleAddTag = () => {
    if (newTemplate.tagInput && !newTemplate.tags.includes(newTemplate.tagInput)) {
      setNewTemplate({
        ...newTemplate,
        tags: [...newTemplate.tags, newTemplate.tagInput],
        tagInput: ''
      });
    }
  };

  const handleUseTemplate = (template: PostTemplate) => {
    // Обновляем счетчик использования
    const updatedTemplates = templates.map(t => 
      t.id === template.id ? { ...t, usageCount: t.usageCount + 1 } : t
    );
    saveTemplates(updatedTemplates);

    // Если есть переменные, показываем форму заполнения
    if (template.variables.length > 0) {
      setShowUseTemplate(template);
      setTemplateVariables({});
    } else {
      // Иначе сразу создаем пост
      toast.success('Контент скопирован! Переходите к созданию поста.');
      // Здесь можно добавить логику перехода к созданию поста с заполненным текстом
    }
  };

  const applyTemplateWithVariables = () => {
    if (!showUseTemplate) return;

    const filledContent = substituteVariables(showUseTemplate.content, templateVariables);
    
    // Здесь можно добавить логику создания поста или копирования в буфер
    navigator.clipboard.writeText(filledContent).then(() => {
      toast.success('Готовый контент скопирован в буфер обмена!');
    });
    
    setShowUseTemplate(null);
    setTemplateVariables({});
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Шаблоны постов</h1>
        <p className="text-gray-400">Создавайте и управляйте шаблонами для быстрого создания контента</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <svg className="h-6 w-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Всего шаблонов</p>
                <p className="text-2xl font-bold text-white">{templates.length}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Категорий</p>
                <p className="text-2xl font-bold text-white">
                  {new Set(templates.map(t => t.category)).size}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Использований</p>
                <p className="text-2xl font-bold text-white">
                  {templates.reduce((sum, t) => sum + t.usageCount, 0)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Популярный</p>
                <p className="text-sm font-bold text-white truncate">
                  {templates.length > 0 
                    ? templates.reduce((prev, current) => 
                        current.usageCount > prev.usageCount ? current : prev
                      ).name
                    : 'Нет данных'
                  }
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Фильтры и поиск */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Поиск шаблонов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <select
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">Все категории</option>
          {TEMPLATE_CATEGORIES.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>

        <Button onClick={() => setShowCreateForm(true)}>
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Создать шаблон
        </Button>
      </div>

      {/* Форма создания/редактирования */}
      {showCreateForm && (
        <Card className="mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingTemplate ? 'Редактировать шаблон' : 'Создать шаблон'}
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Input
                  placeholder="Название шаблона"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                />

                <select
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                >
                  {TEMPLATE_CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Теги
                  </label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      placeholder="Добавить тег"
                      value={newTemplate.tagInput}
                      onChange={(e) => setNewTemplate({ ...newTemplate, tagInput: e.target.value })}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    />
                    <Button variant="secondary" onClick={handleAddTag}>
                      Добавить
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newTemplate.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm cursor-pointer hover:bg-blue-500/30"
                        onClick={() => setNewTemplate({
                          ...newTemplate,
                          tags: newTemplate.tags.filter((_, i) => i !== index)
                        })}
                      >
                        {tag} ×
                      </span>
                    ))}
                  </div>
                </div>

                <textarea
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none"
                  rows={8}
                  placeholder="Содержимое шаблона... Используйте {{переменная}} для динамических значений"
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-400">Превью</h4>
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 min-h-[200px]">
                  <div className="text-white whitespace-pre-wrap">
                    {newTemplate.content || 'Превью появится здесь...'}
                  </div>
                </div>

                {extractVariables(newTemplate.content).length > 0 && (
                  <div>
                    <h4 className="text-md font-medium text-gray-400 mb-2">Переменные</h4>
                    <div className="space-y-2">
                      {extractVariables(newTemplate.content).map((variable, index) => (
                        <div key={index} className="px-3 py-2 bg-yellow-500/20 text-yellow-300 rounded text-sm">
                          {variable}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={createTemplate}>
                {editingTemplate ? 'Сохранить изменения' : 'Создать шаблон'}
              </Button>
              <Button variant="secondary" onClick={resetForm}>
                Отмена
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Модальное окно использования шаблона */}
      {showUseTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Заполните переменные: {showUseTemplate.name}
              </h3>
              
              <div className="space-y-4 mb-6">
                {showUseTemplate.variables.map((variable) => (
                  <div key={variable}>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      {variable}
                    </label>
                    <Input
                      placeholder={`Введите значение для ${variable}`}
                      value={templateVariables[variable] || ''}
                      onChange={(e) => setTemplateVariables({
                        ...templateVariables,
                        [variable]: e.target.value
                      })}
                    />
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-400 mb-2">Превью результата</h4>
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <div className="text-white whitespace-pre-wrap">
                    {substituteVariables(showUseTemplate.content, templateVariables)}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={applyTemplateWithVariables}>
                  Использовать шаблон
                </Button>
                <Button variant="secondary" onClick={() => {
                  setShowUseTemplate(null);
                  setTemplateVariables({});
                }}>
                  Отмена
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Список шаблонов */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white mb-1">{template.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                      {template.category}
                    </span>
                    <span className="text-xs text-gray-400">
                      Использован {template.usageCount} раз
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingTemplate(template);
                      setNewTemplate({
                        name: template.name,
                        content: template.content,
                        category: template.category,
                        tags: template.tags,
                        tagInput: ''
                      });
                      setShowCreateForm(true);
                    }}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Удалить шаблон "${template.name}"?`)) {
                        deleteTemplate(template.id);
                      }
                    }}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>
              </div>

              <div className="text-sm text-gray-300 mb-4 line-clamp-3">
                {template.content}
              </div>

              {template.variables.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-400 mb-2">Переменные:</div>
                  <div className="flex flex-wrap gap-1">
                    {template.variables.map((variable, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs"
                      >
                        {variable}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {template.tags.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {template.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                className="w-full"
                onClick={() => handleUseTemplate(template)}
              >
                Использовать шаблон
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <div className="p-8 text-center">
            <svg className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-400 mb-4">
              {searchQuery || selectedCategory 
                ? 'Шаблоны не найдены для выбранных фильтров'
                : 'У вас пока нет шаблонов'
              }
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              Создать первый шаблон
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}; 