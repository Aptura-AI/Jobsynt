/**
 * ESLint rule to enforce usage of hasCandidateAccess()
 * 
 * This rule prevents direct access checks that bypass hasCandidateAccess()
 * 
 * Usage: Add to your ESLint config or run as a separate check
 */

module.exports = {
  rules: {
    'no-direct-access-check': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce usage of hasCandidateAccess() for all access decisions',
          category: 'Best Practices',
        },
        messages: {
          directCheck: 'Access check bypasses hasCandidateAccess(). Use hasCandidateAccess() or hasCandidateAccessServer() instead.',
        },
      },
      create(context) {
        return {
          // Check for direct is_paid checks
          BinaryExpression(node) {
            if (
              (node.operator === '===' || node.operator === '==' || node.operator === '!==') &&
              ((node.left.type === 'MemberExpression' && 
                node.left.property?.name === 'is_paid') ||
               (node.right.type === 'MemberExpression' && 
                node.right.property?.name === 'is_paid'))
            ) {
              context.report({
                node,
                messageId: 'directCheck',
              });
            }
          },
          // Check for direct trial_ends_at date comparisons
          IfStatement(node) {
            if (node.test.type === 'BinaryExpression') {
              const test = node.test;
              if (
                (test.left.type === 'MemberExpression' && 
                 test.left.property?.name === 'trial_ends_at') ||
                (test.right.type === 'MemberExpression' && 
                 test.right.property?.name === 'trial_ends_at')
              ) {
                context.report({
                  node,
                  messageId: 'directCheck',
                });
              }
            }
          },
        };
      },
    },
  },
};

