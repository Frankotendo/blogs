-- ============================================================
-- FIX SECURITY QUESTIONS FUNCTION
-- ============================================================

-- STEP 1: Drop the broken function
DROP FUNCTION IF EXISTS public.get_security_questions();

-- STEP 2: Create the correct function that returns proper JSON array
CREATE OR REPLACE FUNCTION public.get_security_questions()
RETURNS JSON AS $$
DECLARE
    questions JSON;
BEGIN
    SELECT json_agg(question) INTO questions
    FROM (
        SELECT question 
        FROM public.security_questions 
        WHERE is_active = TRUE 
        ORDER BY id
    ) as ordered_questions;
    
    RETURN COALESCE(questions, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 3: Test the fixed function
SELECT 'FIXED SECURITY QUESTIONS TEST' as test_type, get_security_questions() as available_questions;

-- STEP 4: Create a simple function to get questions as text array (easier for UI)
CREATE OR REPLACE FUNCTION public.get_security_questions_text()
RETURNS TEXT[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT question 
        FROM public.security_questions 
        WHERE is_active = TRUE 
        ORDER BY id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 5: Test the text array function
SELECT 'SECURITY QUESTIONS TEXT ARRAY TEST' as test_type, get_security_questions_text() as questions_array;

-- STEP 6: Grant permissions
GRANT EXECUTE ON FUNCTION public.get_security_questions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_questions_text TO authenticated;

-- ============================================================
-- SECURITY QUESTIONS FUNCTION FIXED
-- ============================================================
